import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/database.js';
import { resetDb } from '../helpers/db.js';
import { assignTeacher, authHeader, createAssessment, createClass, createLearner, createUser } from '../helpers/factories.js';

// The teacher area is rebuilt in Phase 4. Until then these endpoints must keep
// working now that learners are plain records instead of user accounts.

let teacher;
let klass;
let headers;

beforeEach(async () => {
  await resetDb();
  klass = await createClass();
  teacher = await createUser({ role: 'teacher', school_id: klass.school_id });
  await assignTeacher(teacher, klass);
  headers = authHeader(teacher);
});

const birthYear = new Date().getFullYear() - 7;

describe('teacher endpoints on learner records', () => {
  it('adds learners to a class without creating login accounts, skipping bad rows', async () => {
    const res = await request(app)
      .post(`/api/teacher/classes/${klass.class_id}/learners/bulk`)
      .set(headers)
      .send({
        learners: [
          { first_name: 'Ayanda', last_name: 'Zulu', date_of_birth: `${birthYear}-01-10` },
          { first_name: 'Too', last_name: 'Young', date_of_birth: `${new Date().getFullYear() - 1}-01-10` },
          { first_name: 'Busi', last_name: 'Mthembu', date_of_birth: `${birthYear}-02-10` },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.summary).toMatchObject({ success: 2, failed: 1 });
    const learners = await pool.query('SELECT first_name FROM learners WHERE current_class_id = $1 ORDER BY first_name', [
      klass.class_id,
    ]);
    expect(learners.rows.map((r) => r.first_name)).toEqual(['Ayanda', 'Busi']);
    const accounts = await pool.query("SELECT 1 FROM users WHERE role = 'learner'");
    expect(accounts.rows).toHaveLength(0);
  });

  it('lists class learners and the gradebook by name', async () => {
    await createLearner({ klass, first_name: 'Zinhle', last_name: 'Zwane' });
    await createLearner({ klass, first_name: 'Andile', last_name: 'Adams' });
    const assessment = await createAssessment({ teacher, klass });

    const learners = await request(app).get(`/api/teacher/classes/${klass.class_id}/learners`).set(headers);
    const gradebook = await request(app).get(`/api/teacher/assessments/${assessment.assessment_id}/gradebook`).set(headers);
    const details = await request(app).get(`/api/teacher/classes/${klass.class_id}`).set(headers);

    expect(learners.status).toBe(200);
    expect(learners.body.data.learners.map((l) => l.last_name)).toEqual(['Adams', 'Zwane']);
    expect(gradebook.status).toBe(200);
    expect(details.status).toBe(200);
  });
});
