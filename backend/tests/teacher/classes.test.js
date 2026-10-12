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

let teacher;
let klass;
let api;
const YEAR = new Date().getFullYear();
const birthYear = YEAR - 7;

beforeEach(async () => {
  await resetDb();
  klass = await createClass({ class_name: 'Grade 1A' });
  teacher = await createUser({ role: 'teacher', school_id: klass.school_id, first_name: 'Naledi' });
  await assignTeacher(teacher, klass);
  const headers = authHeader(teacher);
  api = (method, path) => request(app)[method](`/api/teacher${path}`).set(headers);
});

describe('dashboard and classes', () => {
  it("shows only the teacher's classes with sizes, averages and what still needs marking", async () => {
    const other = await createClass({ school_id: klass.school_id, class_name: 'Not mine' });
    const a = await createLearner({ klass });
    await createLearner({ klass });
    await createLearner({ klass: other });
    const marked = await createAssessment({ teacher, klass });
    await createAssessment({ teacher, klass, assessment_name: 'Unmarked' });
    await createGrade({ assessment: marked, learner: a, teacher, percentage: 80 });

    const dashboard = await api('get', '/dashboard');
    const list = await api('get', '/classes');

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.summary).toEqual({ classes: 1, learners: 2, to_mark: 2, average: 80 });
    expect(dashboard.body.data.toMark.map((x) => x.assessment_name).sort()).toEqual([marked.assessment_name, 'Unmarked'].sort());
    expect(list.body.data.classes).toHaveLength(1);
    expect(list.body.data.classes[0]).toMatchObject({ class_name: 'Grade 1A', is_primary: true, learner_count: 2, assessment_count: 2 });
  });

  it('builds a marksheet of learners against assessments, per term', async () => {
    const zola = await createLearner({ klass, first_name: 'Zola', last_name: 'Zulu' });
    const term1 = await createAssessment({ teacher, klass, term_number: '1' });
    const term2 = await createAssessment({ teacher, klass, term_number: '2' });
    await createGrade({ assessment: term1, learner: zola, teacher, percentage: 60 });
    await createGrade({ assessment: term2, learner: zola, teacher, percentage: 80 });

    const year = await api('get', `/classes/${klass.class_id}/marksheet`);
    const termOne = await api('get', `/classes/${klass.class_id}/marksheet?term=1`);

    expect(year.body.data.assessments).toHaveLength(2);
    expect(year.body.data.learners[0]).toMatchObject({ first_name: 'Zola', average: 70 });
    expect(termOne.body.data.learners[0]).toMatchObject({ average: 60, marks: { [term1.assessment_id]: 60 } });
  });

  it("hides classes the teacher isn't assigned to", async () => {
    const other = await createClass({ school_id: klass.school_id });

    const responses = await Promise.all([
      api('get', `/classes/${other.class_id}`),
      api('get', `/classes/${other.class_id}/marksheet`),
      api('post', `/classes/${other.class_id}/learners`).send({ first_name: 'A', last_name: 'B', date_of_birth: `${birthYear}-01-01` }),
    ]);

    expect(responses.map((r) => r.status)).toEqual([404, 404, 404]);
  });
});

describe('learners in the class', () => {
  it('adds a learner straight into the class', async () => {
    const res = await api('post', `/classes/${klass.class_id}/learners`).send({
      first_name: 'Ayanda',
      last_name: 'Zulu',
      date_of_birth: `${birthYear}-01-10`,
      class_id: '5d0c0b1e-1111-4222-8333-444455556666', // ignored: always this class
    });

    expect(res.status).toBe(201);
    expect(res.body.data.learner.current_class_id).toBe(klass.class_id);
    expect((await pool.query("SELECT 1 FROM users WHERE role = 'learner'")).rows).toHaveLength(0);
  });

  it('respects the class capacity', async () => {
    await pool.query('UPDATE classes SET max_capacity = 1 WHERE class_id = $1', [klass.class_id]);
    await createLearner({ klass });

    const res = await api('post', `/classes/${klass.class_id}/learners`).send({
      first_name: 'One',
      last_name: 'Toomany',
      date_of_birth: `${birthYear}-01-10`,
    });

    expect(res.status).toBe(409);
  });

  it('imports a register into the class, ignoring any class column', async () => {
    const csv = ['first_name,last_name,date_of_birth,class', `Busi,Mthembu,${birthYear}-02-10,Some other class`].join('\n');

    const res = await api('post', `/classes/${klass.class_id}/learners/import`)
      .field('dry_run', 'false')
      .attach('file', Buffer.from(csv), 'register.csv');

    expect(res.status).toBe(201);
    const { rows } = await pool.query("SELECT current_class_id FROM learners WHERE first_name = 'Busi'");
    expect(rows[0].current_class_id).toBe(klass.class_id);
  });

  it("can't change a past (inactive) class", async () => {
    await pool.query('UPDATE classes SET is_active = false WHERE class_id = $1', [klass.class_id]);

    const res = await api('post', `/classes/${klass.class_id}/learners`).send({
      first_name: 'Late',
      last_name: 'Comer',
      date_of_birth: `${birthYear}-01-10`,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no longer active/);
  });

  it("shows a learner's marks and lets the teacher update guardian details", async () => {
    const learner = await createLearner({ klass });
    const assessment = await createAssessment({ teacher, klass, assessment_name: 'Phonics check' });
    await createGrade({ assessment, learner, teacher, percentage: 45 });

    const profile = await api('get', `/learners/${learner.learner_id}`);
    const update = await api('put', `/learners/${learner.learner_id}`).send({ guardian_phone: '0711234567', school_id: null });

    expect(profile.body.data.marks).toMatchObject([{ assessment_name: 'Phonics check', percentage: 45 }]);
    expect(update.status).toBe(200);
    expect(update.body.data.learner).toMatchObject({ guardian_phone: '0711234567', school_id: klass.school_id });
  });

  it("can't see or edit learners outside the teacher's classes", async () => {
    const elsewhere = await createLearner({ school_id: klass.school_id });

    const view = await api('get', `/learners/${elsewhere.learner_id}`);
    const edit = await api('put', `/learners/${elsewhere.learner_id}`).send({ first_name: 'Hacked' });

    expect([view.status, edit.status]).toEqual([404, 404]);
  });
});
