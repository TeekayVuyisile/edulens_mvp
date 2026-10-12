import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/database.js';
import { resetDb } from '../helpers/db.js';
import { assignTeacher, authHeader, createAssessment, createClass, createLearner, createUser } from '../helpers/factories.js';

let admin;
let headers;
const YEAR = new Date().getFullYear();

beforeEach(async () => {
  await resetDb();
  admin = await createUser({ role: 'school_admin' });
  headers = authHeader(admin);
});

const api = (method, path) => request(app)[method](`/api/school-admin${path}`).set(headers);

describe('class list', () => {
  it("shows this year's active classes in grade order with sizes and teachers", async () => {
    const teacher = await createUser({ role: 'teacher', school_id: admin.school_id, first_name: 'Naledi' });
    const g1 = await createClass({ school_id: admin.school_id, class_name: 'Grade 1A', grade_level: '1' });
    await createClass({ school_id: admin.school_id, class_name: 'Grade RA', grade_level: 'R' });
    await createClass({ school_id: admin.school_id, class_name: 'Old', academic_year: YEAR - 1 });
    await createClass({ class_name: 'Elsewhere' });
    await assignTeacher(teacher, g1);
    await createLearner({ klass: g1 });
    await createLearner({ klass: g1, academic_status: 'inactive' });

    const res = await api('get', '/classes');

    expect(res.status).toBe(200);
    expect(res.body.data.year).toBe(YEAR);
    expect(res.body.data.years).toEqual([YEAR, YEAR - 1]);
    expect(res.body.data.classes.map((c) => c.class_name)).toEqual(['Grade RA', 'Grade 1A']);
    expect(res.body.data.classes[1]).toMatchObject({
      learner_count: 1,
      teachers: [{ first_name: 'Naledi', is_primary: true }],
    });
  });

  it('shows another year when asked', async () => {
    await createClass({ school_id: admin.school_id, class_name: 'Old', academic_year: YEAR - 1 });

    const res = await api('get', `/classes?year=${YEAR - 1}`);

    expect(res.body.data.classes.map((c) => c.class_name)).toEqual(['Old']);
  });
});

describe('creating and editing classes', () => {
  it('creates a class with a class teacher', async () => {
    const teacher = await createUser({ role: 'teacher', school_id: admin.school_id });

    const res = await api('post', '/classes').send({
      class_name: 'Grade 2B',
      grade_level: '2',
      academic_year: YEAR,
      max_capacity: 32,
      teacher_id: teacher.user_id,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.class).toMatchObject({
      class_name: 'Grade 2B',
      school_id: admin.school_id,
      primary_teacher_id: teacher.user_id,
      max_capacity: 32,
    });
  });

  it('refuses a duplicate class name in the same year', async () => {
    await createClass({ school_id: admin.school_id, class_name: 'Grade 2B' });

    const res = await api('post', '/classes').send({ class_name: 'Grade 2B', grade_level: '2', academic_year: YEAR });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe(`There is already a class called Grade 2B in ${YEAR}`);
  });

  it("refuses a teacher from another school or one who's deactivated", async () => {
    const outsider = await createUser({ role: 'teacher' });
    const inactive = await createUser({ role: 'teacher', school_id: admin.school_id, is_active: false });
    const body = { class_name: 'Grade 2B', grade_level: '2', academic_year: YEAR };

    const foreign = await api('post', '/classes').send({ ...body, teacher_id: outsider.user_id });
    const off = await api('post', '/classes').send({ ...body, teacher_id: inactive.user_id });

    expect(foreign.status).toBe(400);
    expect(off.status).toBe(400);
    expect((await pool.query('SELECT 1 FROM classes')).rows).toHaveLength(0);
  });

  it('rejects grades outside Foundation Phase', async () => {
    const res = await api('post', '/classes').send({ class_name: 'Grade 4A', grade_level: '4', academic_year: YEAR });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].path).toBe('grade_level');
  });

  it("won't shrink capacity below the learners already in the class", async () => {
    const klass = await createClass({ school_id: admin.school_id });
    await createLearner({ klass });
    await createLearner({ klass });

    const res = await api('put', `/classes/${klass.class_id}`).send({ max_capacity: 1 });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].path).toBe('max_capacity');
  });

  it('only deactivates an empty class', async () => {
    const klass = await createClass({ school_id: admin.school_id });
    const learner = await createLearner({ klass });

    const refused = await api('patch', `/classes/${klass.class_id}/status`).send({ is_active: false });
    await api('delete', `/classes/${klass.class_id}/learners/${learner.learner_id}`);
    const allowed = await api('patch', `/classes/${klass.class_id}/status`).send({ is_active: false });

    expect(refused.status).toBe(409);
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.class.is_active).toBe(false);
  });

  it('deletes a class created by mistake, but not one with assessments', async () => {
    const mistake = await createClass({ school_id: admin.school_id });
    const used = await createClass({ school_id: admin.school_id });
    const teacher = await createUser({ role: 'teacher', school_id: admin.school_id });
    await createAssessment({ teacher, klass: used });

    const ok = await api('delete', `/classes/${mistake.class_id}`);
    const refused = await api('delete', `/classes/${used.class_id}`);

    expect(ok.status).toBe(200);
    expect(refused.status).toBe(409);
    expect(refused.body.dependents).toMatchObject({ assessments: 1 });
  });
});

describe('class teachers', () => {
  it('has one class teacher; choosing another makes the first a support teacher', async () => {
    const klass = await createClass({ school_id: admin.school_id });
    const first = await createUser({ role: 'teacher', school_id: admin.school_id, first_name: 'First' });
    const second = await createUser({ role: 'teacher', school_id: admin.school_id, first_name: 'Second' });

    await api('post', `/classes/${klass.class_id}/teachers`).send({ teacher_id: first.user_id, is_primary: true });
    const res = await api('post', `/classes/${klass.class_id}/teachers`).send({ teacher_id: second.user_id, is_primary: true });

    expect(res.status).toBe(200);
    expect(res.body.data.class.primary_teacher_id).toBe(second.user_id);
    expect(res.body.data.class.teachers.map((t) => [t.first_name, t.is_primary])).toEqual([
      ['Second', true],
      ['First', false],
    ]);
  });

  it('clears the class teacher when they are removed', async () => {
    const klass = await createClass({ school_id: admin.school_id });
    const teacher = await createUser({ role: 'teacher', school_id: admin.school_id });
    await api('post', `/classes/${klass.class_id}/teachers`).send({ teacher_id: teacher.user_id, is_primary: true });

    const res = await api('delete', `/classes/${klass.class_id}/teachers/${teacher.user_id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.class).toMatchObject({ primary_teacher_id: null, teachers: [] });
  });
});

describe('placing learners', () => {
  it('adds several learners at once, moving them from other classes', async () => {
    const from = await createClass({ school_id: admin.school_id });
    const to = await createClass({ school_id: admin.school_id });
    const a = await createLearner({ school_id: admin.school_id });
    const b = await createLearner({ klass: from });

    const res = await api('post', `/classes/${to.class_id}/learners`).send({ learner_ids: [a.learner_id, b.learner_id] });

    expect(res.status).toBe(200);
    expect(res.body.data.class.learner_count).toBe(2);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM learners WHERE current_class_id = $1', [from.class_id]);
    expect(rows[0].n).toBe(0);
  });

  it('refuses more learners than the class has room for, and places none', async () => {
    const klass = await createClass({ school_id: admin.school_id, max_capacity: 1 });
    const a = await createLearner({ school_id: admin.school_id });
    const b = await createLearner({ school_id: admin.school_id });

    const res = await api('post', `/classes/${klass.class_id}/learners`).send({ learner_ids: [a.learner_id, b.learner_id] });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/only has room for 1 more learner\./);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM learners WHERE current_class_id = $1', [klass.class_id]);
    expect(rows[0].n).toBe(0);
  });

  it('shows the class with its learners', async () => {
    const klass = await createClass({ school_id: admin.school_id });
    await createLearner({ klass, first_name: 'Zola', last_name: 'Zulu' });
    await createLearner({ klass, first_name: 'Anele', last_name: 'Adams' });

    const res = await api('get', `/classes/${klass.class_id}`);

    expect(res.body.data.learners.map((l) => l.last_name)).toEqual(['Adams', 'Zulu']);
  });

  it("hides other schools' classes", async () => {
    const foreign = await createClass();

    const responses = await Promise.all([
      api('get', `/classes/${foreign.class_id}`),
      api('put', `/classes/${foreign.class_id}`).send({ class_name: 'Hacked' }),
      api('delete', `/classes/${foreign.class_id}`),
    ]);

    expect(responses.map((r) => r.status)).toEqual([404, 404, 404]);
  });
});
