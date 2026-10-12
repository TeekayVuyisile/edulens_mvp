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
  createLearner,
  createSchool,
  createUser,
} from '../helpers/factories.js';

/** A school with a class, its teacher, one learner and an assessment. */
const createClassroom = async () => {
  const school = await createSchool();
  const klass = await createClass({ school_id: school.school_id });
  const teacher = await createUser({ role: 'teacher', school_id: school.school_id });
  await assignTeacher(teacher, klass);
  const learner = await createLearner({ klass });
  const assessment = await createAssessment({ teacher, klass, total_marks: 20 });
  return { school, klass, teacher, learner, assessment };
};

const bulkGrade = (teacher, assessmentId, marks) =>
  request(app)
    .put(`/api/teacher/assessments/${assessmentId}/marks`)
    .set(authHeader(teacher))
    .send({ marks });

describe('teacher: grading', () => {
  beforeEach(resetDb);

  it('lets a teacher grade learners in their own assessment', async () => {
    const { teacher, learner, assessment } = await createClassroom();

    const res = await bulkGrade(teacher, assessment.assessment_id, [
      { learner_id: learner.learner_id, marks_obtained: 15 },
    ]);

    expect(res.status).toBe(200);
    const { rows } = await pool.query('SELECT percentage FROM grades WHERE learner_id = $1', [
      learner.learner_id,
    ]);
    expect(Number(rows[0].percentage)).toBe(75);
  });

  it("hides another teacher's assessment", async () => {
    const { learner, assessment } = await createClassroom();
    const { teacher: otherTeacher } = await createClassroom();

    const res = await bulkGrade(otherTeacher, assessment.assessment_id, [
      { learner_id: learner.learner_id, marks_obtained: 0 },
    ]);

    expect(res.status).toBe(404);
    const { rows } = await pool.query('SELECT 1 FROM grades');
    expect(rows).toHaveLength(0);
  });

  it("refuses grades for learners outside the assessment's class", async () => {
    const { teacher, assessment } = await createClassroom();
    const { learner: outsider } = await createClassroom();

    const res = await bulkGrade(teacher, assessment.assessment_id, [
      { learner_id: outsider.learner_id, marks_obtained: 10 },
    ]);

    expect(res.status).toBe(400);
    expect(res.body.data.learner_ids).toEqual([outsider.learner_id]);
  });
});

describe('teacher: learner profiles', () => {
  beforeEach(resetDb);

  it('shows learners in the teacher’s classes', async () => {
    const { teacher, learner } = await createClassroom();

    const res = await request(app)
      .get(`/api/teacher/learners/${learner.learner_id}`)
      .set(authHeader(teacher));

    expect(res.status).toBe(200);
    expect(res.body.data.learner.learner_id).toBe(learner.learner_id);
  });

  it('hides learners from other classes, including other schools', async () => {
    const { teacher } = await createClassroom();
    const { learner: elsewhere } = await createClassroom();

    const res = await request(app)
      .get(`/api/teacher/learners/${elsewhere.learner_id}`)
      .set(authHeader(teacher));

    expect(res.status).toBe(404);
  });
});

describe('school admin: placing learners', () => {
  beforeEach(resetDb);

  it("cannot move another school's learner", async () => {
    const { learner } = await createClassroom();
    const admin = await createUser({ role: 'school_admin' });
    const ownClass = await createClass({ school_id: admin.school_id, grade_level: '2' });

    const res = await request(app)
      .patch(`/api/school-admin/learners/${learner.learner_id}/class`)
      .set(authHeader(admin))
      .send({ class_id: ownClass.class_id });

    expect(res.status).toBe(404);
    const { rows } = await pool.query('SELECT current_class_id FROM learners WHERE learner_id = $1', [
      learner.learner_id,
    ]);
    expect(rows[0].current_class_id).toBe(learner.current_class_id);
  });

  it("cannot move a learner into another school's class", async () => {
    const { school, learner } = await createClassroom();
    const admin = await createUser({ role: 'school_admin', school_id: school.school_id });
    const foreignClass = await createClass();

    const res = await request(app)
      .patch(`/api/school-admin/learners/${learner.learner_id}/class`)
      .set(authHeader(admin))
      .send({ class_id: foreignClass.class_id });

    expect(res.status).toBe(404);
  });

  it("cannot place another school's learners into its own class", async () => {
    const { learner } = await createClassroom();
    const admin = await createUser({ role: 'school_admin' });
    const ownClass = await createClass({ school_id: admin.school_id });

    const res = await request(app)
      .post(`/api/school-admin/classes/${ownClass.class_id}/learners`)
      .set(authHeader(admin))
      .send({ learner_ids: [learner.learner_id] });

    expect(res.status).toBe(404);
  });
});

describe('mass assignment / SQL injection through update bodies', () => {
  beforeEach(resetDb);

  it('ignores unknown and protected keys when a school admin updates a class', async () => {
    const admin = await createUser({ role: 'school_admin' });
    const klass = await createClass({ school_id: admin.school_id });
    const otherSchool = await createSchool();

    const res = await request(app)
      .put(`/api/school-admin/classes/${klass.class_id}`)
      .set(authHeader(admin))
      .send({
        class_name: 'Grade 1 - Sunflowers',
        school_id: otherSchool.school_id,
        'class_name = class_name; DROP TABLE grades; --': 'x',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.class).toMatchObject({
      class_name: 'Grade 1 - Sunflowers',
      school_id: admin.school_id,
    });
    const { rows } = await pool.query("SELECT to_regclass('public.grades') AS oid");
    expect(rows[0].oid).not.toBeNull();
  });

  it('ignores protected keys when a super admin updates a user', async () => {
    const superAdmin = await createUser({ role: 'super_admin' });
    const teacher = await createUser({ role: 'teacher' });

    const res = await request(app)
      .put(`/api/super-admin/users/${teacher.user_id}`)
      .set(authHeader(superAdmin))
      .send({ first_name: 'Renamed', password_hash: 'x', role: 'super_admin' });

    expect(res.status).toBe(200);
    const { rows } = await pool.query('SELECT first_name, role, password_hash FROM users WHERE user_id = $1', [
      teacher.user_id,
    ]);
    expect(rows[0].first_name).toBe('Renamed');
    expect(rows[0].role).toBe('teacher');
    expect(rows[0].password_hash).not.toBe('x');
  });
});
