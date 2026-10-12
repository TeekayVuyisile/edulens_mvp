import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/database.js';
import { resetDb } from '../helpers/db.js';
import {
  authHeader,
  createAssessment,
  createClass,
  createGrade,
  createLearner,
  createUser,
} from '../helpers/factories.js';

let admin;
let headers;

beforeEach(async () => {
  await resetDb();
  admin = await createUser({ role: 'school_admin' });
  headers = authHeader(admin);
});

const api = (method, path) => request(app)[method](`/api/school-admin${path}`).set(headers);

/** A date of birth that makes a learner `age` years old today. */
const bornYearsAgo = (age) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - age);
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().slice(0, 10);
};

const validLearner = (overrides = {}) => ({
  first_name: 'Amahle',
  last_name: 'Dlamini',
  date_of_birth: bornYearsAgo(7),
  gender: 'Female',
  guardian_name: 'Zanele Dlamini',
  guardian_phone: '082 123 4567',
  ...overrides,
});

describe('adding a learner', () => {
  it('creates a plain record with no login account', async () => {
    const usersBefore = (await pool.query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n;

    const res = await api('post', '/learners').send(validLearner({ admission_number: 'A-001' }));

    expect(res.status).toBe(201);
    expect(res.body.data.learner).toMatchObject({
      first_name: 'Amahle',
      school_id: admin.school_id,
      current_class_id: null,
      admission_number: 'A-001',
    });
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n).toBe(usersBefore);
  });

  it('keeps the date of birth exactly as entered', async () => {
    const res = await api('post', '/learners').send(validLearner({ date_of_birth: '2019-03-01' }));

    expect(res.body.data.learner.date_of_birth).toBe('2019-03-01');
  });

  it('places the learner in a class and records the placement', async () => {
    const klass = await createClass({ school_id: admin.school_id });

    const res = await api('post', '/learners').send(validLearner({ class_id: klass.class_id }));

    expect(res.body.data.learner.current_class_id).toBe(klass.class_id);
    const { rows } = await pool.query('SELECT class_id, completed_date FROM learner_class_history WHERE learner_id = $1', [
      res.body.data.learner.learner_id,
    ]);
    expect(rows).toEqual([{ class_id: klass.class_id, completed_date: null }]);
  });

  it('refuses a class that is full', async () => {
    const klass = await createClass({ school_id: admin.school_id, max_capacity: 1 });
    await createLearner({ klass });

    const res = await api('post', '/learners').send(validLearner({ class_id: klass.class_id }));

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/is full/);
  });

  it("refuses another school's class", async () => {
    const foreign = await createClass();

    const res = await api('post', '/learners').send(validLearner({ class_id: foreign.class_id }));

    expect(res.status).toBe(404);
  });

  it.each([
    ['too young', { date_of_birth: bornYearsAgo(2) }, 'date_of_birth'],
    ['too old', { date_of_birth: bornYearsAgo(14) }, 'date_of_birth'],
    ['not a date', { date_of_birth: '31/02/2019' }, 'date_of_birth'],
    ['missing name', { first_name: '  ' }, 'first_name'],
    ['bad gender', { gender: 'Unknown' }, 'gender'],
    ['bad guardian email', { guardian_email: 'nope' }, 'guardian_email'],
  ])('rejects a learner who is %s', async (_label, overrides, field) => {
    const res = await api('post', '/learners').send(validLearner(overrides));

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.path)).toEqual([field]);
  });

  it('rejects duplicates by admission number and by name + birthday', async () => {
    await api('post', '/learners').send(validLearner({ admission_number: 'A-001' }));

    const sameNumber = await api('post', '/learners').send(validLearner({ first_name: 'Other', admission_number: 'a-001' }));
    const samePerson = await api('post', '/learners').send(validLearner());

    expect(sameNumber.status).toBe(409);
    expect(sameNumber.body.message).toMatch(/admission number/);
    expect(samePerson.status).toBe(409);
    expect(samePerson.body.message).toMatch(/already on the register/);
  });
});

describe('the register', () => {
  it('lists current learners by default and counts each group', async () => {
    const klass = await createClass({ school_id: admin.school_id, grade_level: '2' });
    await createLearner({ klass, first_name: 'Placed' });
    await createLearner({ school_id: admin.school_id, first_name: 'Unplaced' });
    await createLearner({ school_id: admin.school_id, first_name: 'Gone', academic_status: 'inactive' });
    await createLearner({ first_name: 'ElsewhereSchool' });

    const current = await api('get', '/learners');
    const unplaced = await api('get', '/learners?status=unplaced');
    const left = await api('get', '/learners?status=left');
    const grade2 = await api('get', '/learners?grade=2');

    expect(current.body.data.learners.map((l) => l.first_name).sort()).toEqual(['Placed', 'Unplaced']);
    expect(current.body.data.counts).toEqual({ all: 3, current: 2, unplaced: 1, left: 1 });
    expect(unplaced.body.data.learners.map((l) => l.first_name)).toEqual(['Unplaced']);
    expect(left.body.data.learners.map((l) => l.first_name)).toEqual(['Gone']);
    expect(grade2.body.data.learners.map((l) => l.first_name)).toEqual(['Placed']);
  });

  it('searches names, admission numbers and guardians', async () => {
    await createLearner({ school_id: admin.school_id, first_name: 'Kagiso', admission_number: 'X-77' });
    await createLearner({ school_id: admin.school_id, first_name: 'Lwazi' });

    const byName = await api('get', '/learners?search=kag');
    const byNumber = await api('get', '/learners?search=x-77');

    expect(byName.body.data.learners.map((l) => l.first_name)).toEqual(['Kagiso']);
    expect(byNumber.body.data.learners.map((l) => l.first_name)).toEqual(['Kagiso']);
  });
});

describe('a learner record', () => {
  it('shows class history and marks per subject', async () => {
    const klass = await createClass({ school_id: admin.school_id });
    const teacher = await createUser({ role: 'teacher', school_id: admin.school_id });
    const created = await api('post', '/learners').send(validLearner({ class_id: klass.class_id }));
    const learner = created.body.data.learner;
    const assessment = await createAssessment({ teacher, klass });
    await createGrade({ assessment, learner, teacher, percentage: 70 });

    const res = await api('get', `/learners/${learner.learner_id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.learner.class_name).toBe(klass.class_name);
    expect(res.body.data.history).toHaveLength(1);
    expect(res.body.data.performance).toEqual([{ subject_name: 'Other', assessments: 1, average: 70 }]);
  });

  it('updates details through the allow-list only', async () => {
    const learner = await createLearner({ school_id: admin.school_id });

    const res = await api('put', `/learners/${learner.learner_id}`).send({
      guardian_phone: '0711234567',
      school_id: '5d0c0b1e-1111-4222-8333-444455556666',
      academic_status: 'graduated',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.learner).toMatchObject({
      guardian_phone: '0711234567',
      school_id: admin.school_id,
      academic_status: 'active',
    });
  });

  it('moves a learner between classes and keeps the history', async () => {
    const from = await createClass({ school_id: admin.school_id });
    const to = await createClass({ school_id: admin.school_id });
    const created = await api('post', '/learners').send(validLearner({ class_id: from.class_id }));
    const id = created.body.data.learner.learner_id;

    const res = await api('patch', `/learners/${id}/class`).send({ class_id: to.class_id });

    expect(res.status).toBe(200);
    expect(res.body.data.learner.current_class_id).toBe(to.class_id);
    const { rows } = await pool.query(
      'SELECT class_id, completed_date IS NOT NULL AS closed FROM learner_class_history WHERE learner_id = $1 ORDER BY created_at',
      [id]
    );
    expect(rows).toEqual([
      { class_id: from.class_id, closed: true },
      { class_id: to.class_id, closed: false },
    ]);
  });

  it('marks a learner as having left, which takes them out of their class', async () => {
    const klass = await createClass({ school_id: admin.school_id });
    const learner = await createLearner({ klass });

    const res = await api('patch', `/learners/${learner.learner_id}/status`).send({ academic_status: 'inactive' });

    expect(res.status).toBe(200);
    expect(res.body.data.learner).toMatchObject({ academic_status: 'inactive', current_class_id: null });
  });

  it('only places learners who are still at the school', async () => {
    const klass = await createClass({ school_id: admin.school_id });
    const learner = await createLearner({ school_id: admin.school_id, academic_status: 'inactive' });

    const res = await api('patch', `/learners/${learner.learner_id}/class`).send({ class_id: klass.class_id });

    expect(res.status).toBe(400);
  });

  it('deletes a learner added by mistake, but not one with marks', async () => {
    const klass = await createClass({ school_id: admin.school_id });
    const teacher = await createUser({ role: 'teacher', school_id: admin.school_id });
    const mistake = await createLearner({ school_id: admin.school_id });
    const marked = await createLearner({ klass });
    await createGrade({ assessment: await createAssessment({ teacher, klass }), learner: marked, teacher });

    const ok = await api('delete', `/learners/${mistake.learner_id}`);
    const refused = await api('delete', `/learners/${marked.learner_id}`);

    expect(ok.status).toBe(200);
    expect(refused.status).toBe(409);
    expect(refused.body.message).toMatch(/marks recorded/);
  });

  it("hides learners from other schools", async () => {
    const outsider = await createLearner();

    const responses = await Promise.all([
      api('get', `/learners/${outsider.learner_id}`),
      api('put', `/learners/${outsider.learner_id}`).send({ first_name: 'Hacked' }),
      api('patch', `/learners/${outsider.learner_id}/status`).send({ academic_status: 'inactive' }),
      api('delete', `/learners/${outsider.learner_id}`),
    ]);

    expect(responses.map((r) => r.status)).toEqual([404, 404, 404, 404]);
  });
});
