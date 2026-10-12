import pool from '../../config/database.js';
import ClassModel from '../../models/Class.js';
import Worksheet from '../../models/Worksheet.js';
import {
  AiGenerationError,
  AiNotConfiguredError,
  buildPrompt,
  generateWorksheet,
  isConfigured,
} from '../../services/worksheets/generator.js';
import { validateWorksheet } from '../../services/worksheets/schema.js';
import { badRequest, conflict, HttpError, notFound } from '../../utils/httpError.js';
import { created, ok } from '../../utils/respond.js';

/** Generations allowed per teacher per 24 hours (each one costs money). */
const dailyLimit = () => Number(process.env.WORKSHEET_DAILY_LIMIT) || 30;

/** Subjects (with topics) in the curricula assigned to the school. */
const schoolSubjects = async (schoolId) => {
  const { rows } = await pool.query(
    `SELECT s.subject_id, s.subject_name, s.grade_level, cur.curriculum_id, cur.curriculum_name,
            COALESCE((SELECT json_agg(json_build_object('topic_id', t.topic_id, 'topic_name', t.topic_name,
                                                        'learning_objectives', t.learning_objectives)
                                      ORDER BY t.topic_name)
                      FROM topics t WHERE t.subject_id = s.subject_id AND t.is_active), '[]'::json) AS topics
     FROM subjects s
     JOIN curricula cur ON cur.curriculum_id = s.curriculum_id AND cur.is_active
     WHERE s.is_active AND EXISTS (
       SELECT 1 FROM school_curriculum_assignments sca
       WHERE sca.school_id = $1 AND sca.is_active AND sca.curriculum_id = s.curriculum_id
         AND (sca.grade_level = s.grade_level OR sca.grade_level = 'R-3' OR s.grade_level = 'R-3'))
     ORDER BY s.subject_name, s.grade_level`,
    [schoolId]
  );
  return rows;
};

const subjectFitsGrade = (subject, grade) => subject.grade_level === grade || subject.grade_level === 'R-3';

// GET /api/teacher/worksheets/options — subjects/topics, the teacher's grades, and AI status
export const getOptions = async (req, res) => {
  const [subjects, classes, usedToday] = await Promise.all([
    schoolSubjects(req.user.schoolId),
    ClassModel.forTeacher(req.user.userId),
    Worksheet.countRecent(req.user.userId),
  ]);
  ok(res, {
    subjects,
    grades: [...new Set(classes.map((c) => c.grade_level))],
    ai: { configured: isConfigured(), dailyLimit: dailyLimit(), usedToday },
  });
};

// POST /api/teacher/worksheets/generate
export const generate = async (req, res) => {
  if (!isConfigured()) {
    throw new HttpError(503, 'AI worksheets aren’t set up on this server yet. Ask your administrator to add an OpenAI API key.');
  }
  const { subject_id: subjectId, topic_id: topicId, grade_level: grade } = req.body;
  const subject = (await schoolSubjects(req.user.schoolId)).find((s) => s.subject_id === subjectId);
  if (!subject || !subjectFitsGrade(subject, grade)) {
    throw badRequest('Choose a subject your school teaches in this grade', { errors: [{ path: 'subject_id', msg: 'Choose a subject for this grade' }] });
  }
  const topic = topicId ? subject.topics.find((t) => t.topic_id === topicId) : null;
  if (topicId && !topic) throw badRequest('That topic isn’t part of the subject', { errors: [{ path: 'topic_id', msg: 'Choose a topic from this subject' }] });

  if ((await Worksheet.countRecent(req.user.userId)) >= dailyLimit()) {
    throw new HttpError(429, `You’ve made ${dailyLimit()} worksheets in the last 24 hours, the daily limit. Try again tomorrow, or reuse one from the library.`);
  }

  const request = {
    curriculumName: subject.curriculum_name,
    subjectName: subject.subject_name,
    topicName: topic?.topic_name,
    objectives: topic?.learning_objectives,
    gradeLevel: grade,
    difficulty: req.body.difficulty,
    numberOfQuestions: req.body.number_of_questions,
    questionTypes: req.body.question_types,
    language: req.body.language,
    instructions: req.body.specific_instructions?.trim() || null,
  };
  const requestId = await Worksheet.createRequest({
    ...request,
    teacherId: req.user.userId,
    schoolId: req.user.schoolId,
    curriculumId: subject.curriculum_id,
    subjectId,
    topicId: topic?.topic_id,
    prompt: buildPrompt(request),
  });

  try {
    await Worksheet.completeRequest(requestId, await generateWorksheet(request));
  } catch (error) {
    await Worksheet.failRequest(requestId, error.message);
    if (error instanceof AiNotConfiguredError) {
      console.error('Worksheet generation is misconfigured:', error.message);
      throw new HttpError(503, 'AI worksheets aren’t set up correctly on this server. Ask your administrator to check the OpenAI API key.');
    }
    if (error instanceof AiGenerationError) {
      console.error('Worksheet generation failed:', error.message);
      throw new HttpError(502, 'The AI couldn’t make this worksheet just now. Please try again.');
    }
    throw error;
  }
  created(res, { request: await Worksheet.findRequest(requestId, req.user.userId) }, 'Your worksheet is ready');
};

// GET /api/teacher/worksheets/requests — recent generations
export const listRequests = async (req, res) => {
  ok(res, { requests: await Worksheet.recentRequests(req.user.userId) });
};

// GET /api/teacher/worksheets/requests/:requestId
export const getRequest = async (req, res) => {
  const request = await Worksheet.findRequest(req.params.requestId, req.user.userId);
  if (!request) throw notFound('Worksheet not found');
  ok(res, { request });
};

/** A teacher's edits, checked like the AI's output. */
const checked = (input) => {
  const { worksheet, errors } = validateWorksheet(input);
  if (!worksheet) throw badRequest(errors[0], { data: { problems: errors } });
  return worksheet;
};

// POST /api/teacher/worksheets/library  { request_id, worksheet? } — save a generated (and maybe edited) worksheet
export const saveToLibrary = async (req, res) => {
  const request = await Worksheet.findRequest(req.body.request_id, req.user.userId);
  if (!request || request.status !== 'completed') throw notFound('Worksheet not found');
  if (request.saved_worksheet_id) throw conflict('This worksheet is already in the library', { data: { worksheet_id: request.saved_worksheet_id } });

  const worksheet = checked(req.body.worksheet ?? request.content);
  const worksheetId = await Worksheet.save({ request, teacherId: req.user.userId, schoolId: req.user.schoolId, worksheet });
  created(res, { worksheet: await Worksheet.findInSchool(worksheetId, req.user.schoolId) }, `${worksheet.title} was saved to the library`);
};

// GET /api/teacher/worksheets/library?mine=true&search=&grade=&subject=
export const listLibrary = async (req, res) => {
  const worksheets = await Worksheet.library(req.user.schoolId, {
    owner: req.query.mine === 'true' ? req.user.userId : undefined,
    search: req.query.search?.trim() || undefined,
    grade: req.query.grade || undefined,
    subject: req.query.subject || undefined,
  });
  ok(res, { worksheets });
};

const findOr404 = async (req) => {
  const worksheet = await Worksheet.findInSchool(req.params.worksheetId, req.user.schoolId);
  if (!worksheet) throw notFound('Worksheet not found');
  return worksheet;
};

/** Anyone at the school can use a worksheet; only its author changes it. */
const findOwnOr404 = async (req) => {
  const worksheet = await findOr404(req);
  if (worksheet.teacher_id !== req.user.userId) throw new HttpError(403, 'Only the teacher who made this worksheet can change it');
  return worksheet;
};

// GET /api/teacher/worksheets/library/:worksheetId
export const getWorksheet = async (req, res) => {
  ok(res, { worksheet: await findOr404(req) });
};

// PUT /api/teacher/worksheets/library/:worksheetId  { worksheet }
export const updateWorksheet = async (req, res) => {
  const existing = await findOwnOr404(req);
  await Worksheet.update(existing.worksheet_id, checked(req.body.worksheet));
  ok(res, { worksheet: await Worksheet.findInSchool(existing.worksheet_id, req.user.schoolId) }, 'Worksheet saved');
};

// DELETE /api/teacher/worksheets/library/:worksheetId
export const deleteWorksheet = async (req, res) => {
  const existing = await findOwnOr404(req);
  await Worksheet.delete(existing.worksheet_id);
  ok(res, undefined, `${existing.worksheet_title} was deleted`);
};
