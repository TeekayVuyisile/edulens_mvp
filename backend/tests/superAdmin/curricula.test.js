import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/database.js';
import { resetDb } from '../helpers/db.js';
import { assignTeacher, authHeader, createClass, createSchool, createUser } from '../helpers/factories.js';

let headers;

beforeEach(async () => {
  await resetDb();
  headers = authHeader(await createUser({ role: 'super_admin' }));
});

const post = (path, body) => request(app).post(`/api/super-admin${path}`).set(headers).send(body);
const put = (path, body) => request(app).put(`/api/super-admin${path}`).set(headers).send(body);
const patch = (path, body) => request(app).patch(`/api/super-admin${path}`).set(headers).send(body);
const del = (path) => request(app).delete(`/api/super-admin${path}`).set(headers);
const tree = (query = '') => request(app).get(`/api/super-admin/curricula${query}`).set(headers);

/** CAPS with Mathematics (Grade 1) containing "Counting". */
const buildCaps = async () => {
  const curriculum = (await post('/curricula', { curriculum_name: 'CAPS' })).body.data.curriculum;
  const subject = (await post(`/curricula/${curriculum.curriculum_id}/subjects`, {
    subject_name: 'Mathematics',
    grade_level: '1',
  })).body.data.subject;
  const topic = (await post(`/subjects/${subject.subject_id}/topics`, { topic_name: 'Counting' })).body.data.topic;
  return { curriculum, subject, topic };
};

describe('building a curriculum', () => {
  it('returns the curriculum → subject → topic tree, subjects ordered by grade', async () => {
    const { curriculum } = await buildCaps();
    await post(`/curricula/${curriculum.curriculum_id}/subjects`, { subject_name: 'Life Skills', grade_level: 'R' });

    const res = await tree();

    expect(res.status).toBe(200);
    const [caps] = res.body.data.curricula;
    expect(caps.subjects.map((s) => `${s.grade_level} ${s.subject_name}`)).toEqual(['R Life Skills', '1 Mathematics']);
    expect(caps.subjects[1].topics.map((t) => t.topic_name)).toEqual(['Counting']);
  });

  it('explains duplicates instead of failing', async () => {
    const { curriculum, subject } = await buildCaps();

    const dupCurriculum = await post('/curricula', { curriculum_name: 'CAPS' });
    const dupSubject = await post(`/curricula/${curriculum.curriculum_id}/subjects`, {
      subject_name: 'Mathematics',
      grade_level: '1',
    });
    const dupTopic = await post(`/subjects/${subject.subject_id}/topics`, { topic_name: 'Counting' });

    expect([dupCurriculum.status, dupSubject.status, dupTopic.status]).toEqual([409, 409, 409]);
    expect(dupSubject.body.message).toMatch(/already has a subject/);
  });

  it('allows the same subject name for a different grade', async () => {
    const { curriculum } = await buildCaps();

    const res = await post(`/curricula/${curriculum.curriculum_id}/subjects`, {
      subject_name: 'Mathematics',
      grade_level: '2',
    });

    expect(res.status).toBe(201);
  });

  it('validates grade levels and required names', async () => {
    const { curriculum } = await buildCaps();

    const res = await post(`/curricula/${curriculum.curriculum_id}/subjects`, { subject_name: '', grade_level: '7' });

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.path).sort()).toEqual(['grade_level', 'subject_name']);
  });

  it('edits names and fields but ignores unknown keys', async () => {
    const { subject, topic } = await buildCaps();

    const subjectRes = await put(`/subjects/${subject.subject_id}`, {
      subject_name: 'Numeracy',
      'subject_name = subject_name; DROP TABLE topics; --': 'x',
    });
    const topicRes = await put(`/topics/${topic.topic_id}`, { learning_objectives: 'Count to 100' });

    expect(subjectRes.status).toBe(200);
    expect(subjectRes.body.data.subject.subject_name).toBe('Numeracy');
    expect(topicRes.body.data.topic.learning_objectives).toBe('Count to 100');
    expect((await pool.query("SELECT to_regclass('public.topics') AS t")).rows[0].t).not.toBeNull();
  });
});

describe('archiving and deleting', () => {
  it('archives and restores, and hides archived items unless asked', async () => {
    const { topic } = await buildCaps();

    await patch(`/topics/${topic.topic_id}/status`, { is_active: false });
    const hidden = await tree();
    const shown = await tree('?include_archived=true');
    await patch(`/topics/${topic.topic_id}/status`, { is_active: true });
    const restored = await tree();

    expect(hidden.body.data.curricula[0].subjects[0].topics).toEqual([]);
    expect(shown.body.data.curricula[0].subjects[0].topics[0]).toMatchObject({ topic_name: 'Counting', is_active: false });
    expect(restored.body.data.curricula[0].subjects[0].topics).toHaveLength(1);
  });

  it('deletes an unused subject together with its topics', async () => {
    const { subject, topic } = await buildCaps();

    const res = await del(`/subjects/${subject.subject_id}`);

    expect(res.status).toBe(200);
    expect((await pool.query('SELECT 1 FROM topics WHERE topic_id = $1', [topic.topic_id])).rows).toHaveLength(0);
  });

  it('refuses to delete a topic that assessments use, suggesting archive', async () => {
    const { subject, topic } = await buildCaps();
    const school = await createSchool();
    const klass = await createClass({ school_id: school.school_id });
    const teacher = await createUser({ role: 'teacher', school_id: school.school_id });
    await assignTeacher(teacher, klass);
    await pool.query(
      `INSERT INTO assessments (class_id, teacher_id, subject_id, topic_id, assessment_name, assessment_type, total_marks, term_number)
       VALUES ($1, $2, $3, $4, 'Counting quiz', 'quiz', 10, '1')`,
      [klass.class_id, teacher.user_id, subject.subject_id, topic.topic_id]
    );

    const res = await del(`/topics/${topic.topic_id}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/archive it instead/i);
  });

  it('refuses to delete a curriculum assigned to a school', async () => {
    const { curriculum } = await buildCaps();
    const school = await createSchool();
    await post(`/schools/${school.school_id}/curricula`, {
      curriculum_id: curriculum.curriculum_id,
      grade_level: '1',
      academic_year: 2026,
    });

    const res = await del(`/curricula/${curriculum.curriculum_id}`);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/assigned to schools/);
  });

  it('404s for unknown items', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';

    const res = await Promise.all([
      put(`/subjects/${missing}`, { subject_name: 'x' }),
      patch(`/topics/${missing}/status`, { is_active: false }),
      del(`/curricula/${missing}`),
    ]);

    expect(res.map((r) => r.status)).toEqual([404, 404, 404]);
  });
});

describe('assigning curricula to schools', () => {
  it('assigns, lists, removes and re-assigns', async () => {
    const { curriculum } = await buildCaps();
    const school = await createSchool();
    const body = { curriculum_id: curriculum.curriculum_id, grade_level: '1', academic_year: 2026 };

    const assigned = await post(`/schools/${school.school_id}/curricula`, body);
    const duplicate = await post(`/schools/${school.school_id}/curricula`, body);
    const detail = await request(app).get(`/api/super-admin/schools/${school.school_id}`).set(headers);
    const removed = await del(`/schools/${school.school_id}/curricula/${assigned.body.data.assignment.assignment_id}`);
    const reassigned = await post(`/schools/${school.school_id}/curricula`, body);

    expect(assigned.status).toBe(201);
    expect(duplicate.status).toBe(409);
    expect(detail.body.data.curricula).toHaveLength(1);
    expect(detail.body.data.curricula[0]).toMatchObject({ curriculum_name: 'CAPS', grade_level: '1', academic_year: 2026 });
    expect(removed.status).toBe(200);
    expect(reassigned.status).toBe(201);
  });

  it('only removes an assignment through its own school', async () => {
    const { curriculum } = await buildCaps();
    const school = await createSchool();
    const other = await createSchool();
    const assigned = await post(`/schools/${school.school_id}/curricula`, {
      curriculum_id: curriculum.curriculum_id,
      grade_level: '1',
      academic_year: 2026,
    });

    const res = await del(`/schools/${other.school_id}/curricula/${assigned.body.data.assignment.assignment_id}`);

    expect(res.status).toBe(404);
  });

  it('will not assign an archived curriculum', async () => {
    const { curriculum } = await buildCaps();
    const school = await createSchool();
    await patch(`/curricula/${curriculum.curriculum_id}/status`, { is_active: false });

    const res = await post(`/schools/${school.school_id}/curricula`, {
      curriculum_id: curriculum.curriculum_id,
      grade_level: '1',
      academic_year: 2026,
    });

    expect(res.status).toBe(404);
  });
});

describe('/api/curriculum (read-only, any signed-in user)', () => {
  it('requires sign-in', async () => {
    const res = await request(app).get('/api/curriculum');

    expect(res.status).toBe(401);
  });

  it('lists active curricula for teachers', async () => {
    await buildCaps();
    const teacher = await createUser({ role: 'teacher' });

    const res = await request(app).get('/api/curriculum').set(authHeader(teacher));

    expect(res.status).toBe(200);
    expect(res.body.data.curricula.map((c) => c.curriculum_name)).toEqual(['CAPS']);
  });
});
