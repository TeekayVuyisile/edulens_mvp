import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/database.js';
import { describeActivity } from '../../src/services/activityDescriptions.js';
import { resetDb } from '../helpers/db.js';
import { authHeader, createClass, createLearner, createSchool, createUser } from '../helpers/factories.js';

describe('GET /api/super-admin/statistics', () => {
  beforeEach(resetDb);

  it('summarises the platform and lists schools needing an admin', async () => {
    const admin = await createUser({ role: 'super_admin' });
    const school = await createSchool({ school_name: 'Needs Admin' });
    const klass = await createClass({ school_id: school.school_id, grade_level: '2' });
    await createLearner({ klass });
    await createUser({ role: 'teacher', school_id: school.school_id });
    await pool.query(
      `INSERT INTO activity_logs (user_id, action_type, action_details)
       VALUES ($1, 'POST /api/super-admin/schools', '{"statusCode": 201}'),
              ($1, 'GET /api/super-admin/schools', '{"statusCode": 200}'),
              ($1, 'POST /api/auth/login', '{"statusCode": 200}'),
              ($1, 'POST /login', '{"statusCode": 200}'),
              ($1, 'PATCH /users/abc/toggle-active', '{"statusCode": 200}'),
              ($1, 'USER_ACTIVATED', '{}'),
              (NULL, 'POST /api/super-admin/schools', '{"statusCode": 201}'),
              ($1, 'POST /api/super-admin/curricula', '{"statusCode": 409}')`,
      [admin.user_id]
    );

    const res = await request(app).get('/api/super-admin/statistics').set(authHeader(admin));

    expect(res.status).toBe(200);
    const { summary, growth, learnersByGrade, recentActivity, attention } = res.body.data;
    expect(summary).toMatchObject({ schools: 1, active_schools: 1, teachers: 1, learners: 1, pending_invites: 1 });
    expect(growth).toHaveLength(12);
    expect(growth.at(-1)).toMatchObject({ schools: 1, learners: 1 });
    expect(learnersByGrade).toEqual([{ grade: '2', learners: 1 }]);
    // Page views, sign-ins, legacy-format rows, anonymous rows and failed requests are left out.
    expect(recentActivity.map((a) => a.description)).toEqual(['Added a school']);
    expect(attention.schoolsWithoutAdmin.map((s) => s.school_name)).toEqual(['Needs Admin']);
  });
});

describe('describeActivity', () => {
  it.each([
    ['POST /api/auth/login', 'Signed in'],
    ['PATCH /api/super-admin/schools/5d0c0b1e-1111-4222-8333-444455556666/status', 'Changed a school’s status'],
    ['POST /api/teacher/assessments/abc/bulk-grade', 'Recorded marks'],
    ['DELETE /api/school-admin/classes/5d0c0b1e-1111-4222-8333-444455556666/learners/5d0c0b1e-1111-4222-8333-444455556666', 'Deleted learners'],
    ['PUT /classes', 'Updated classes'],
  ])('%s → %s', (actionType, expected) => {
    expect(describeActivity(actionType)).toBe(expected);
  });
});
