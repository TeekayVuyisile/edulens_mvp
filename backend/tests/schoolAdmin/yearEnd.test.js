import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/database.js';
import { resetDb } from '../helpers/db.js';
import {
  assignTeacher,
  authHeader,
  createAssessment,
  createClass,
  createGrade,
  createLearner,
  createUser,
} from '../helpers/factories.js';

const YEAR = 2026;
let admin;
let api;

beforeEach(async () => {
  await resetDb();
  admin = await createUser({ role: 'school_admin' });
  const headers = authHeader(admin);
  api = (method, path) => request(app)[method](`/api/school-admin${path}`).set(headers);
});

const klass = (overrides) => createClass({ school_id: admin.school_id, academic_year: YEAR, ...overrides });

/** A learner placed through the API so their class history is recorded. */
const placedLearner = async (inClass, overrides = {}) => {
  const learner = await createLearner({ school_id: admin.school_id, ...overrides });
  await api('patch', `/learners/${learner.learner_id}/class`).send({ class_id: inClass.class_id });
  return learner;
};

describe('year-end overview', () => {
  it('suggests promotion to the matching class, graduation for Grade 3, and flags low averages', async () => {
    const g1a = await klass({ class_name: 'Grade 1A', grade_level: '1' });
    const g3a = await klass({ class_name: 'Grade 3A', grade_level: '3' });
    await createClass({ school_id: admin.school_id, academic_year: YEAR + 1, class_name: 'Grade 2B', grade_level: '2' });
    const next2a = await createClass({ school_id: admin.school_id, academic_year: YEAR + 1, class_name: 'Grade 2A', grade_level: '2' });
    const teacher = await createUser({ role: 'teacher', school_id: admin.school_id });
    const struggling = await placedLearner(g1a, { first_name: 'Struggling' });
    await placedLearner(g3a);
    await createGrade({ assessment: await createAssessment({ teacher, klass: g1a }), learner: struggling, teacher, percentage: 30 });

    const res = await api('get', `/year-end?year=${YEAR}`);

    expect(res.status).toBe(200);
    const [first, third] = res.body.data.classes;
    expect(res.body.data).toMatchObject({ fromYear: YEAR, toYear: YEAR + 1, rollover: null });
    expect(first.suggestion).toEqual({ outcome: 'promote', class_id: next2a.class_id });
    expect(first.learners[0]).toMatchObject({ first_name: 'Struggling', needs_review: true });
    expect(third.suggestion).toEqual({ outcome: 'graduate', class_id: null });
  });

  it("defaults to the school's current year", async () => {
    await klass({ class_name: 'Grade 1A' });

    const res = await api('get', '/year-end');

    expect(res.body.data.fromYear).toBe(YEAR);
  });
});

describe("creating next year's classes", () => {
  it('copies names, grades, sizes and (optionally) teachers, skipping classes that exist', async () => {
    const g1a = await klass({ class_name: 'Grade 1A', grade_level: '1', max_capacity: 25 });
    await klass({ class_name: 'Grade 2A', grade_level: '2' });
    await createClass({ school_id: admin.school_id, academic_year: YEAR + 1, class_name: 'Grade 2A', grade_level: '2' });
    const teacher = await createUser({ role: 'teacher', school_id: admin.school_id });
    await assignTeacher(teacher, g1a);

    const res = await api('post', '/year-end/next-classes').send({ from_year: YEAR, copy_teachers: true });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ created: 1, skipped: 1 });
    const { rows } = await pool.query(
      `SELECT c.class_name, c.max_capacity, c.primary_teacher_id FROM classes c
       WHERE c.academic_year = $1 AND c.class_name = 'Grade 1A'`,
      [YEAR + 1]
    );
    expect(rows).toEqual([{ class_name: 'Grade 1A', max_capacity: 25, primary_teacher_id: teacher.user_id }]);
  });
});

describe('closing the year', () => {
  const setup = async () => {
    const g1a = await klass({ class_name: 'Grade 1A', grade_level: '1' });
    const g3a = await klass({ class_name: 'Grade 3A', grade_level: '3' });
    const next2a = await createClass({ school_id: admin.school_id, academic_year: YEAR + 1, class_name: 'Grade 2A', grade_level: '2' });
    const next1a = await createClass({ school_id: admin.school_id, academic_year: YEAR + 1, class_name: 'Grade 1A', grade_level: '1' });
    const promoted = await placedLearner(g1a, { first_name: 'Promoted' });
    const repeating = await placedLearner(g1a, { first_name: 'Repeating' });
    const graduate = await placedLearner(g3a, { first_name: 'Graduate' });
    const leaver = await placedLearner(g3a, { first_name: 'Leaver' });
    return { g1a, g3a, next1a, next2a, promoted, repeating, graduate, leaver };
  };

  it('moves every learner, records their history, closes the year and can only run once', async () => {
    const s = await setup();
    const decisions = [
      { learner_id: s.promoted.learner_id, outcome: 'promote', class_id: s.next2a.class_id },
      { learner_id: s.repeating.learner_id, outcome: 'repeat', class_id: s.next1a.class_id },
      { learner_id: s.graduate.learner_id, outcome: 'graduate' },
      { learner_id: s.leaver.learner_id, outcome: 'leave' },
    ];

    const res = await api('post', '/year-end/complete').send({ from_year: YEAR, decisions });
    const again = await api('post', '/year-end/complete').send({ from_year: YEAR, decisions });

    expect(res.status).toBe(200);
    expect(res.body.data.summary).toEqual({ promote: 1, repeat: 1, graduate: 1, leave: 1, unplaced: 0 });
    const learners = await pool.query('SELECT first_name, academic_status, current_class_id FROM learners ORDER BY first_name');
    expect(learners.rows).toEqual([
      { first_name: 'Graduate', academic_status: 'graduated', current_class_id: null },
      { first_name: 'Leaver', academic_status: 'inactive', current_class_id: null },
      { first_name: 'Promoted', academic_status: 'active', current_class_id: s.next2a.class_id },
      { first_name: 'Repeating', academic_status: 'repeated', current_class_id: s.next1a.class_id },
    ]);
    const history = await pool.query(
      `SELECT h.status, c.academic_year, h.completed_date IS NOT NULL AS closed
       FROM learner_class_history h JOIN classes c USING (class_id)
       WHERE h.learner_id = $1 ORDER BY c.academic_year`,
      [s.promoted.learner_id]
    );
    expect(history.rows).toEqual([
      { status: 'promoted', academic_year: YEAR, closed: true },
      { status: 'active', academic_year: YEAR + 1, closed: false },
    ]);
    const old = await pool.query('SELECT bool_or(is_active) AS any_active FROM classes WHERE academic_year = $1', [YEAR]);
    expect(old.rows[0].any_active).toBe(false);
    expect(again.status).toBe(409);

    const overview = await api('get', `/year-end?year=${YEAR}`);
    expect(overview.body.data.rollover.summary).toMatchObject({ promote: 1 });
  });

  it('needs a decision for every learner', async () => {
    const s = await setup();

    const res = await api('post', '/year-end/complete').send({
      from_year: YEAR,
      decisions: [{ learner_id: s.promoted.learner_id, outcome: 'promote', class_id: s.next2a.class_id }],
    });

    expect(res.status).toBe(400);
    expect(res.body.data.missing).toHaveLength(3);
  });

  it.each([
    ['a Grade 3 learner promoted', (s) => ({ learner_id: s.graduate.learner_id, outcome: 'promote' }), /finish Foundation Phase or repeat/],
    ['a Grade 1 learner graduating', (s) => ({ learner_id: s.promoted.learner_id, outcome: 'graduate' }), /Only Grade 3/],
    ['promotion into the wrong grade', (s) => ({ learner_id: s.promoted.learner_id, outcome: 'promote', class_id: s.next1a.class_id }), /needs a Grade 2 class/],
  ])('refuses %s', async (_label, bad, message) => {
    const s = await setup();
    const decisions = [
      { learner_id: s.promoted.learner_id, outcome: 'promote', class_id: s.next2a.class_id },
      { learner_id: s.repeating.learner_id, outcome: 'repeat', class_id: s.next1a.class_id },
      { learner_id: s.graduate.learner_id, outcome: 'graduate' },
      { learner_id: s.leaver.learner_id, outcome: 'leave' },
    ].map((d) => (d.learner_id === bad(s).learner_id ? bad(s) : d));

    const res = await api('post', '/year-end/complete').send({ from_year: YEAR, decisions });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
    const { rows } = await pool.query('SELECT 1 FROM academic_year_rollovers');
    expect(rows).toHaveLength(0);
  });

  it('respects next year’s class sizes', async () => {
    const s = await setup();
    await pool.query('UPDATE classes SET max_capacity = 1 WHERE class_id = $1', [s.next1a.class_id]);
    await createLearner({ klass: s.next1a });

    const res = await api('post', '/year-end/complete').send({
      from_year: YEAR,
      decisions: [
        { learner_id: s.promoted.learner_id, outcome: 'promote', class_id: s.next2a.class_id },
        { learner_id: s.repeating.learner_id, outcome: 'repeat', class_id: s.next1a.class_id },
        { learner_id: s.graduate.learner_id, outcome: 'graduate' },
        { learner_id: s.leaver.learner_id, outcome: 'leave' },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Grade 1A would have 2 learners but has 1 places/);
  });

  it("can't close another school's learners", async () => {
    const other = await createClass({ academic_year: YEAR });
    const outsider = await createLearner({ klass: other });
    await klass({ class_name: 'Grade 1A' });

    const res = await api('post', '/year-end/complete').send({
      from_year: YEAR,
      decisions: [{ learner_id: outsider.learner_id, outcome: 'leave' }],
    });

    expect(res.status).toBe(400);
    expect(res.body.data.unknown).toEqual([outsider.learner_id]);
  });
});
