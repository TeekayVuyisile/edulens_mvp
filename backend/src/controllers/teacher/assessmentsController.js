import path from 'path';
import pool from '../../config/database.js';
import Assessment from '../../models/Assessment.js';
import { withTransaction } from '../../db/transaction.js';
import { RESOURCE_TYPES } from '../../middleware/uploadMiddleware.js';
import { badRequest, notFound } from '../../utils/httpError.js';
import { created, ok } from '../../utils/respond.js';
import { findAssessmentForTeacher, findClassForTeacher, requireActiveClass } from './scope.js';

/**
 * Subjects (with topics) a class can be assessed on: those in the curricula
 * the school is assigned for the class's grade and year.
 */
const subjectsForClass = async (klass) => {
  const { rows } = await pool.query(
    `SELECT s.subject_id, s.subject_name, s.subject_code, s.curriculum_id, cur.curriculum_name,
            COALESCE((SELECT json_agg(json_build_object('topic_id', t.topic_id, 'topic_name', t.topic_name)
                                      ORDER BY t.topic_name)
                      FROM topics t WHERE t.subject_id = s.subject_id AND t.is_active), '[]'::json) AS topics
     FROM subjects s
     JOIN curricula cur ON cur.curriculum_id = s.curriculum_id AND cur.is_active
     WHERE s.is_active
       AND s.grade_level IN ($2, 'R-3')
       AND s.curriculum_id IN (
         SELECT sca.curriculum_id FROM school_curriculum_assignments sca
         WHERE sca.school_id = $1 AND sca.is_active AND sca.academic_year = $3
           AND sca.grade_level IN ($2, 'R-3'))
     ORDER BY s.subject_name`,
    [klass.school_id, klass.grade_level, klass.academic_year]
  );
  return rows;
};

/** Checks the subject/topic belong to the class's curriculum; fills in curriculum_id. */
const resolveSubject = async (klass, { subject_id: subjectId, topic_id: topicId }) => {
  if (!subjectId) {
    if (topicId) throw badRequest('Choose a subject for this topic', { errors: [{ path: 'subject_id', msg: 'Choose a subject' }] });
    return { subject_id: null, topic_id: null, curriculum_id: null };
  }
  const subject = (await subjectsForClass(klass)).find((s) => s.subject_id === subjectId);
  if (!subject) {
    throw badRequest('That subject isn’t taught in this class', {
      errors: [{ path: 'subject_id', msg: 'Choose a subject from this class’s curriculum' }],
    });
  }
  if (topicId && !subject.topics.some((t) => t.topic_id === topicId)) {
    throw badRequest('That topic isn’t part of the subject', { errors: [{ path: 'topic_id', msg: 'Choose a topic from this subject' }] });
  }
  return { subject_id: subjectId, topic_id: topicId || null, curriculum_id: subject.curriculum_id };
};

// GET /api/teacher/assessments/options?class_id= — subjects and topics for the form
export const getOptions = async (req, res) => {
  const klass = await findClassForTeacher(req.query.class_id, req.user.userId);
  ok(res, { class: klass, subjects: await subjectsForClass(klass) });
};

// GET /api/teacher/assessments?class_id=&term=&year=&status=to_mark|marked&search=
export const listAssessments = async (req, res) => {
  const assessments = await Assessment.listForTeacher(req.user.userId, {
    classId: req.query.class_id || undefined,
    term: req.query.term || undefined,
    year: Number(req.query.year) || undefined,
    status: req.query.status || undefined,
    search: req.query.search?.trim() || undefined,
  });
  ok(res, { assessments });
};

// POST /api/teacher/assessments
export const createAssessment = async (req, res) => {
  const klass = requireActiveClass(await findClassForTeacher(req.body.class_id, req.user.userId));
  const subject = await resolveSubject(klass, req.body);
  const assessment = await Assessment.create({ ...req.body, ...subject, class_id: klass.class_id, teacher_id: req.user.userId });
  created(res, { assessment: await Assessment.findForTeacher(assessment.assessment_id, req.user.userId) }, `${assessment.assessment_name} was created`);
};

// GET /api/teacher/assessments/:assessmentId
export const getAssessment = async (req, res) => {
  const assessment = await findAssessmentForTeacher(req.params.assessmentId, req.user.userId);
  const resources = await Assessment.resources(assessment.assessment_id);
  ok(res, { assessment, resources });
};

// PUT /api/teacher/assessments/:assessmentId
export const updateAssessment = async (req, res) => {
  const existing = requireActiveClass(await findAssessmentForTeacher(req.params.assessmentId, req.user.userId));
  const changes = { ...req.body };

  if ('subject_id' in req.body || 'topic_id' in req.body) {
    const klass = await findClassForTeacher(existing.class_id, req.user.userId);
    Object.assign(changes, await resolveSubject(klass, {
      subject_id: 'subject_id' in req.body ? req.body.subject_id : existing.subject_id,
      topic_id: 'topic_id' in req.body ? req.body.topic_id : existing.topic_id,
    }));
  }

  const totalChanged = req.body.total_marks !== undefined && Number(req.body.total_marks) !== Number(existing.total_marks);
  if (totalChanged) {
    const { rows } = await pool.query('SELECT MAX(marks_obtained)::float AS highest FROM grades WHERE assessment_id = $1', [
      existing.assessment_id,
    ]);
    if (rows[0].highest !== null && rows[0].highest > Number(req.body.total_marks)) {
      throw badRequest('Total marks is lower than a mark already recorded', {
        errors: [{ path: 'total_marks', msg: `A learner already has ${rows[0].highest} marks` }],
      });
    }
  }

  await Assessment.update(existing.assessment_id, changes);
  if (totalChanged) await Assessment.recalculate(existing.assessment_id, Number(req.body.total_marks));
  const assessment = await Assessment.findForTeacher(existing.assessment_id, req.user.userId);
  ok(res, { assessment }, 'Assessment saved');
};

// DELETE /api/teacher/assessments/:assessmentId — also removes its marks and resources
export const deleteAssessment = async (req, res) => {
  const existing = requireActiveClass(await findAssessmentForTeacher(req.params.assessmentId, req.user.userId));
  await Assessment.delete(existing.assessment_id);
  ok(res, undefined, `${existing.assessment_name} was deleted`);
};

// GET /api/teacher/assessments/:assessmentId/marks
export const getMarks = async (req, res) => {
  const assessment = await findAssessmentForTeacher(req.params.assessmentId, req.user.userId);
  const marks = await Assessment.marks(assessment.assessment_id, assessment.class_id);
  ok(res, { assessment, marks });
};

// PUT /api/teacher/assessments/:assessmentId/marks  { marks: [{ learner_id, marks_obtained | null, teacher_feedback }] }
export const saveMarks = async (req, res) => {
  const assessment = requireActiveClass(await findAssessmentForTeacher(req.params.assessmentId, req.user.userId));
  const total = Number(assessment.total_marks);

  // Learners who can be marked: those in the class now, and anyone already marked for it.
  const sheet = await Assessment.marks(assessment.assessment_id, assessment.class_id);
  const allowed = new Set(sheet.map((row) => row.learner_id));
  const outside = req.body.marks.map((m) => m.learner_id).filter((id) => !allowed.has(id));
  if (outside.length > 0) {
    throw badRequest('Some learners are not in this assessment’s class', { data: { learner_ids: outside } });
  }

  const tooHigh = req.body.marks.filter((m) => m.marks_obtained !== null && Number(m.marks_obtained) > total);
  if (tooHigh.length > 0) {
    throw badRequest(`Marks can’t be more than the total of ${total}`, { data: { learner_ids: tooHigh.map((m) => m.learner_id) } });
  }

  const result = await withTransaction((client) => Assessment.saveMarks(assessment, req.body.marks, req.user.userId, client));
  const [updated, marks] = await Promise.all([
    Assessment.findForTeacher(assessment.assessment_id, req.user.userId),
    Assessment.marks(assessment.assessment_id, assessment.class_id),
  ]);
  const parts = [result.saved && `${result.saved} mark${result.saved === 1 ? '' : 's'} saved`, result.cleared && `${result.cleared} cleared`];
  ok(res, { assessment: updated, marks, ...result }, parts.filter(Boolean).join(', ') || 'Nothing to save');
};

// POST /api/teacher/assessments/:assessmentId/resources — a file (multipart "file") or a link ({ resource_name, resource_url })
export const addResource = async (req, res) => {
  const assessment = requireActiveClass(await findAssessmentForTeacher(req.params.assessmentId, req.user.userId));

  let resource;
  if (req.file) {
    const [type, mimeType] = RESOURCE_TYPES[path.extname(req.file.originalname).toLowerCase()];
    resource = await Assessment.addResource({
      assessmentId: assessment.assessment_id,
      name: req.file.originalname.slice(0, 255),
      type,
      mimeType,
      data: req.file.buffer,
      size: req.file.size,
      uploadedBy: req.user.userId,
    });
  } else {
    const url = req.body.resource_url?.trim();
    if (!url || !/^https?:\/\/\S+$/i.test(url)) {
      throw badRequest('Attach a file or enter a link starting with https://', {
        errors: [{ path: 'resource_url', msg: 'Enter a link starting with https://' }],
      });
    }
    resource = await Assessment.addResource({
      assessmentId: assessment.assessment_id,
      name: (req.body.resource_name?.trim() || url).slice(0, 255),
      type: 'link',
      url,
      uploadedBy: req.user.userId,
    });
  }
  created(res, { resource }, `${resource.resource_name} was added`);
};

// GET /api/teacher/assessments/:assessmentId/resources/:resourceId/download
export const downloadResource = async (req, res) => {
  const assessment = await findAssessmentForTeacher(req.params.assessmentId, req.user.userId);
  const file = await Assessment.resourceFile(assessment.assessment_id, req.params.resourceId);
  if (!file?.file_data) throw notFound('File not found');

  res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.resource_name)}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(file.file_data);
};

// DELETE /api/teacher/assessments/:assessmentId/resources/:resourceId
export const deleteResource = async (req, res) => {
  const assessment = requireActiveClass(await findAssessmentForTeacher(req.params.assessmentId, req.user.userId));
  if (!(await Assessment.deleteResource(assessment.assessment_id, req.params.resourceId))) {
    throw notFound('Resource not found');
  }
  ok(res, undefined, 'Resource removed');
};
