import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/database.js';
import { resetDb } from '../helpers/db.js';
import { assignTeacher, authHeader, createAssessment, createClass, createGrade, createLearner, createUser } from '../helpers/factories.js';

let teacher;
let klass;
let api;
const YEAR = new Date().getFullYear();

beforeEach(async () => {
  await resetDb();
  klass = await createClass({ class_name: 'Grade 2B', grade_level: '2', academic_year: YEAR });
  teacher = await createUser({ role: 'teacher', school_id: klass.school_id });
  await assignTeacher(teacher, klass);
  api = (method, path, as = teacher) => request(app)[method](`/api/teacher${path}`).set(authHeader(as));
});

/** A curriculum assigned to the school for `grade`, with one subject and topic. */
const createCurriculum = async ({ grade = '2', year = YEAR, schoolId = klass.school_id } = {}) => {
  const { rows: [cur] } = await pool.query('INSERT INTO curricula (curriculum_name) VALUES ($1) RETURNING curriculum_id', [
    `CAPS Grade ${grade} ${year}`,
  ]);
  const { rows: [subject] } = await pool.query(
    "INSERT INTO subjects (curriculum_id, subject_name, grade_level) VALUES ($1, 'Mathematics', $2) RETURNING subject_id",
    [cur.curriculum_id, grade]
  );
  const { rows: [topic] } = await pool.query(
    "INSERT INTO topics (subject_id, topic_name) VALUES ($1, 'Counting') RETURNING topic_id",
    [subject.subject_id]
  );
  await pool.query(
    'INSERT INTO school_curriculum_assignments (school_id, curriculum_id, grade_level, academic_year) VALUES ($1, $2, $3, $4)',
    [schoolId, cur.curriculum_id, grade, year]
  );
  return { curriculumId: cur.curriculum_id, subjectId: subject.subject_id, topicId: topic.topic_id };
};

const newAssessment = (overrides = {}) => ({
  class_id: klass.class_id,
  assessment_name: 'Counting to 100',
  assessment_type: 'test',
  total_marks: 20,
  term_number: '4',
  ...overrides,
});

describe('creating assessments', () => {
  it("offers the subjects and topics in the class's curriculum", async () => {
    const { subjectId } = await createCurriculum();
    await createCurriculum({ grade: '3' }); // another grade: not offered

    const res = await api('get', `/assessments/options?class_id=${klass.class_id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.subjects).toMatchObject([{ subject_id: subjectId, topics: [{ topic_name: 'Counting' }] }]);
  });

  it('creates an assessment linked to its curriculum', async () => {
    const { curriculumId, subjectId, topicId } = await createCurriculum();

    const res = await api('post', '/assessments').send(newAssessment({ subject_id: subjectId, topic_id: topicId }));

    expect(res.status).toBe(201);
    expect(res.body.data.assessment).toMatchObject({
      curriculum_id: curriculumId,
      subject_name: 'Mathematics',
      learner_count: 0,
      marked_count: 0,
    });
  });

  it("rejects a subject from outside the class's curriculum", async () => {
    const { subjectId } = await createCurriculum({ grade: '3' });

    const res = await api('post', '/assessments').send(newAssessment({ subject_id: subjectId }));

    expect(res.status).toBe(400);
    expect(res.body.errors[0].path).toBe('subject_id');
  });

  it("can't create assessments for someone else's class", async () => {
    const other = await createClass({ school_id: klass.school_id });

    const res = await api('post', '/assessments').send(newAssessment({ class_id: other.class_id }));

    expect(res.status).toBe(404);
  });

  it('explains invalid fields', async () => {
    const res = await api('post', '/assessments').send(newAssessment({ total_marks: 0, term_number: '5', assessment_name: '' }));

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.path).sort()).toEqual(['assessment_name', 'term_number', 'total_marks']);
  });
});

describe('marking', () => {
  it('saves marks, works out percentages and CAPS levels, and clears a mark sent as null', async () => {
    const a = await createLearner({ klass, first_name: 'Anele' });
    const b = await createLearner({ klass, first_name: 'Bongi' });
    const assessment = await createAssessment({ teacher, klass, total_marks: 20 });

    const first = await api('put', `/assessments/${assessment.assessment_id}/marks`).send({
      marks: [
        { learner_id: a.learner_id, marks_obtained: 17, teacher_feedback: ' Great counting ' },
        { learner_id: b.learner_id, marks_obtained: 9 },
      ],
    });
    const second = await api('put', `/assessments/${assessment.assessment_id}/marks`).send({
      marks: [{ learner_id: b.learner_id, marks_obtained: null }],
    });

    expect(first.status).toBe(200);
    expect(first.body.message).toBe('2 marks saved');
    expect(first.body.data.assessment).toMatchObject({ marked_count: 2, learner_count: 2, average: 65 });
    expect(second.body.data.marks.map((m) => [m.first_name, m.percentage])).toEqual([
      ['Anele', 85],
      ['Bongi', null],
    ]);
    const { rows } = await pool.query('SELECT grade_letter, teacher_feedback FROM grades');
    expect(rows).toEqual([{ grade_letter: '7', teacher_feedback: 'Great counting' }]);
  });

  it('refuses marks above the total', async () => {
    const learner = await createLearner({ klass });
    const assessment = await createAssessment({ teacher, klass, total_marks: 10 });

    const res = await api('put', `/assessments/${assessment.assessment_id}/marks`).send({
      marks: [{ learner_id: learner.learner_id, marks_obtained: 11 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/total of 10/);
  });

  it('keeps marks of learners who have since moved class on the sheet', async () => {
    const learner = await createLearner({ klass, first_name: 'Moved' });
    const assessment = await createAssessment({ teacher, klass });
    await createGrade({ assessment, learner, teacher, percentage: 50 });
    await pool.query('UPDATE learners SET current_class_id = NULL WHERE learner_id = $1', [learner.learner_id]);

    const res = await api('get', `/assessments/${assessment.assessment_id}/marks`);

    expect(res.body.data.marks).toMatchObject([{ first_name: 'Moved', in_class: false, percentage: 50 }]);
  });

  it('lets support teachers in the class mark too', async () => {
    const support = await createUser({ role: 'teacher', school_id: klass.school_id });
    await assignTeacher(support, klass, { is_primary: false });
    const learner = await createLearner({ klass });
    const assessment = await createAssessment({ teacher, klass });

    const res = await api('put', `/assessments/${assessment.assessment_id}/marks`, support).send({
      marks: [{ learner_id: learner.learner_id, marks_obtained: 5 }],
    });

    expect(res.status).toBe(200);
  });

  it('recalculates percentages when the total changes, but not below a recorded mark', async () => {
    const learner = await createLearner({ klass });
    const assessment = await createAssessment({ teacher, klass, total_marks: 20 });
    await api('put', `/assessments/${assessment.assessment_id}/marks`).send({
      marks: [{ learner_id: learner.learner_id, marks_obtained: 10 }],
    });

    const tooLow = await api('put', `/assessments/${assessment.assessment_id}`).send({ total_marks: 5 });
    const ok = await api('put', `/assessments/${assessment.assessment_id}`).send({ total_marks: 40 });

    expect(tooLow.status).toBe(400);
    expect(ok.body.data.assessment.average).toBe(25);
  });

  it('lists what still needs marking', async () => {
    const learner = await createLearner({ klass });
    const done = await createAssessment({ teacher, klass, assessment_name: 'Done' });
    await createAssessment({ teacher, klass, assessment_name: 'Waiting' });
    await createGrade({ assessment: done, learner, teacher });

    const toMark = await api('get', '/assessments?status=to_mark');
    const marked = await api('get', '/assessments?status=marked');

    expect(toMark.body.data.assessments.map((a) => a.assessment_name)).toEqual(['Waiting']);
    expect(marked.body.data.assessments.map((a) => a.assessment_name)).toEqual(['Done']);
  });

  it('freezes assessments of past (inactive) classes', async () => {
    const assessment = await createAssessment({ teacher, klass });
    await pool.query('UPDATE classes SET is_active = false WHERE class_id = $1', [klass.class_id]);

    const view = await api('get', `/assessments/${assessment.assessment_id}/marks`);
    const del = await api('delete', `/assessments/${assessment.assessment_id}`);

    expect(view.status).toBe(200);
    expect(del.status).toBe(400);
  });
});

describe('resources', () => {
  it('stores a file and only lets the class’s teachers download it', async () => {
    const assessment = await createAssessment({ teacher, klass });
    const outsider = await createUser({ role: 'teacher', school_id: klass.school_id });

    const upload = await api('post', `/assessments/${assessment.assessment_id}/resources`).attach(
      'file',
      Buffer.from('%PDF-1.4 practice sheet'),
      'practice sheet.pdf'
    );
    const id = upload.body.data.resource.resource_id;
    const download = await api('get', `/assessments/${assessment.assessment_id}/resources/${id}/download`).buffer(true);
    const blocked = await api('get', `/assessments/${assessment.assessment_id}/resources/${id}/download`, outsider);

    expect(upload.status).toBe(201);
    expect(upload.body.data.resource).toMatchObject({ resource_type: 'pdf', file_size: 23 });
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toBe('application/pdf');
    expect(download.headers['content-disposition']).toContain('practice%20sheet.pdf');
    expect(download.body.toString()).toBe('%PDF-1.4 practice sheet');
    expect(blocked.status).toBe(404);
  });

  it('adds links, refuses other file types, and deletes resources', async () => {
    const assessment = await createAssessment({ teacher, klass });
    const base = `/assessments/${assessment.assessment_id}/resources`;

    const link = await api('post', base).send({ resource_name: 'Counting song', resource_url: 'https://www.youtube.com/watch?v=abc' });
    const badLink = await api('post', base).send({ resource_url: 'javascript:alert(1)' });
    const exe = await api('post', base).attach('file', Buffer.from('MZ'), 'virus.exe');
    const removed = await api('delete', `${base}/${link.body.data.resource.resource_id}`);
    const details = await api('get', `/assessments/${assessment.assessment_id}`);

    expect(link.body.data.resource).toMatchObject({ resource_type: 'link', resource_name: 'Counting song' });
    expect(badLink.status).toBe(400);
    expect(exe.status).toBe(400);
    expect(removed.status).toBe(200);
    expect(details.body.data.resources).toEqual([]);
  });
});
