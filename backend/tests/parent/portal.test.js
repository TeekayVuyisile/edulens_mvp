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

let admin;
let klass;
let learner;
let adminApi;

beforeEach(async () => {
  await resetDb();
  admin = await createUser({ role: 'school_admin' });
  klass = await createClass({ school_id: admin.school_id, class_name: 'Grade 2A', grade_level: '2' });
  learner = await createLearner({ klass, first_name: 'Amahle' });
  await pool.query("UPDATE learners SET guardian_name = 'Zanele Dlamini' WHERE learner_id = $1", [learner.learner_id]);
  adminApi = (method, path) => request(app)[method](`/api/school-admin/learners/${learner.learner_id}${path}`).set(authHeader(admin));
});

const parentApi = (parent, path) => request(app).get(`/api/parent${path}`).set(authHeader(parent));

describe('inviting parents', () => {
  it('creates a parent account (named from the learner record) and returns an invitation', async () => {
    const res = await adminApi('post', '/guardians').send({ email: 'Zanele@Example.com', relationship: 'Mother' });

    expect(res.status).toBe(201);
    expect(res.body.data.guardian).toMatchObject({ first_name: 'Zanele', last_name: 'Dlamini', role: 'parent', school_id: null });
    expect(res.body.data.invite.link).toMatch(/invite=1$/);
    const list = await adminApi('get', '/guardians');
    expect(list.body.data.guardians).toMatchObject([{ email: 'zanele@example.com', relationship: 'Mother', last_login: null }]);
  });

  it('links an existing parent to a sibling without a new account', async () => {
    const sibling = await createLearner({ klass, first_name: 'Lwazi' });
    const parent = await createUser({ role: 'parent', school_id: null, email: 'parent@example.com' });
    await pool.query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [parent.user_id]);

    const res = await request(app)
      .post(`/api/school-admin/learners/${sibling.learner_id}/guardians`)
      .set(authHeader(admin))
      .send({ email: 'parent@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.data.invite).toBeNull();
    expect(res.body.message).toMatch(/already has an account/);
    const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM users WHERE role = 'parent'");
    expect(rows[0].n).toBe(1);
  });

  it("won't turn a staff email into a parent, or link twice", async () => {
    const teacher = await createUser({ role: 'teacher', school_id: admin.school_id, email: 'teacher@example.com' });
    const staff = await adminApi('post', '/guardians').send({ email: teacher.email });
    await adminApi('post', '/guardians').send({ email: 'p@example.com', first_name: 'P', last_name: 'Q' });
    const twice = await adminApi('post', '/guardians').send({ email: 'p@example.com' });

    expect(staff.status).toBe(409);
    expect(twice.status).toBe(409);
  });

  it('needs a name when the learner record has none', async () => {
    await pool.query('UPDATE learners SET guardian_name = NULL WHERE learner_id = $1', [learner.learner_id]);

    const res = await adminApi('post', '/guardians').send({ email: 'new@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.path)).toEqual(['first_name', 'last_name']);
  });

  it("can't invite parents for another school's learner", async () => {
    const outsider = await createLearner();

    const res = await request(app)
      .post(`/api/school-admin/learners/${outsider.learner_id}/guardians`)
      .set(authHeader(admin))
      .send({ email: 'x@example.com', first_name: 'X', last_name: 'Y' });

    expect(res.status).toBe(404);
  });

  it('removing the last child deactivates the parent account', async () => {
    const invited = await adminApi('post', '/guardians').send({ email: 'p@example.com', first_name: 'P', last_name: 'Q' });
    const id = invited.body.data.guardian.user_id;

    const res = await adminApi('delete', `/guardians/${id}`);

    expect(res.status).toBe(200);
    const { rows } = await pool.query('SELECT is_active FROM users WHERE user_id = $1', [id]);
    expect(rows[0].is_active).toBe(false);
  });
});

describe('the parent portal', () => {
  const linkedParent = async () => {
    const parent = await createUser({ role: 'parent', school_id: null, password: 'Parent123!', email: 'mom@example.com' });
    await pool.query('INSERT INTO guardian_links (guardian_id, learner_id, relationship) VALUES ($1, $2, $3)', [
      parent.user_id,
      learner.learner_id,
      'Mother',
    ]);
    return parent;
  };

  it('lets parents sign in', async () => {
    await linkedParent();

    const res = await request(app).post('/api/auth/login').send({ email: 'mom@example.com', password: 'Parent123!' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('parent');
  });

  it("shows the parent's children with class teacher, marks and teacher comments, but not internal notes", async () => {
    const parent = await linkedParent();
    const teacher = await createUser({ role: 'teacher', school_id: admin.school_id, first_name: 'Naledi' });
    await assignTeacher(teacher, klass);
    const assessment = await createAssessment({ teacher, klass, assessment_name: 'Reading check' });
    await createGrade({ assessment, learner, teacher, percentage: 75 });
    await pool.query("UPDATE grades SET teacher_feedback = 'Reads with expression' WHERE learner_id = $1", [learner.learner_id]);
    await pool.query("UPDATE learners SET medical_notes = 'Asthma', special_needs_notes = 'Private' WHERE learner_id = $1", [learner.learner_id]);

    const list = await parentApi(parent, '/children');
    const detail = await parentApi(parent, `/children/${learner.learner_id}`);

    expect(list.body.data.children).toMatchObject([
      { first_name: 'Amahle', class_name: 'Grade 2A', teacher_first_name: 'Naledi', average: 75, relationship: 'Mother' },
    ]);
    expect(detail.body.data.marks).toMatchObject([{ assessment_name: 'Reading check', percentage: 75, teacher_feedback: 'Reads with expression' }]);
    expect(JSON.stringify(detail.body)).not.toMatch(/Asthma|Private/);
  });

  it("hides children who aren't linked to the parent", async () => {
    const parent = await linkedParent();
    const other = await createLearner({ klass });

    const res = await parentApi(parent, `/children/${other.learner_id}`);

    expect(res.status).toBe(404);
  });

  it('keeps parents out of staff areas, and staff out of the parent portal', async () => {
    const parent = await linkedParent();

    const staffArea = await request(app).get('/api/teacher/dashboard').set(authHeader(parent));
    const portal = await request(app).get('/api/parent/children').set(authHeader(admin));

    expect(staffArea.status).toBe(403);
    expect(portal.status).toBe(403);
  });

  it('does not list parents among school staff', async () => {
    await linkedParent();
    const superAdmin = await createUser({ role: 'super_admin' });

    const res = await request(app).get('/api/super-admin/users').set(authHeader(superAdmin));

    expect(res.body.data.users.map((u) => u.role)).not.toContain('parent');
  });
});
