import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/database.js';
import { resetDb } from '../helpers/db.js';
import { authHeader, createSchool, createUser } from '../helpers/factories.js';

let headers;
let superAdmin;

beforeEach(async () => {
  await resetDb();
  superAdmin = await createUser({ role: 'super_admin' });
  headers = authHeader(superAdmin);
});

const list = (query = '') => request(app).get(`/api/super-admin/users${query}`).set(headers);
const invite = (body) => request(app).post('/api/super-admin/users').set(headers).send(body);

describe('staff directory', () => {
  it('lists admins and teachers only (no super admins or legacy learner rows)', async () => {
    const school = await createSchool();
    await createUser({ role: 'teacher', school_id: school.school_id });
    await createUser({ role: 'school_admin', school_id: school.school_id });
    await createUser({ role: 'learner', school_id: school.school_id });

    const res = await list();

    expect(res.status).toBe(200);
    expect(res.body.data.users.map((u) => u.role).sort()).toEqual(['school_admin', 'teacher']);
    expect(res.body.data.users[0].school_name).toBe(school.school_name);
  });

  it('separates active, pending (never signed in) and inactive accounts', async () => {
    const signedIn = await createUser({ role: 'teacher' });
    await pool.query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [signedIn.user_id]);
    await createUser({ role: 'teacher' }); // pending
    await createUser({ role: 'teacher', is_active: false });

    const all = await list();
    const pending = await list('?status=pending');

    expect(all.body.data.counts).toEqual({ all: 3, active: 1, pending: 1, inactive: 1 });
    expect(pending.body.data.users).toHaveLength(1);
  });

  it('filters by role, school and search text', async () => {
    const a = await createSchool();
    const b = await createSchool();
    await createUser({ role: 'teacher', school_id: a.school_id, first_name: 'Naledi' });
    await createUser({ role: 'teacher', school_id: b.school_id, first_name: 'Sipho' });
    await createUser({ role: 'school_admin', school_id: a.school_id, first_name: 'Nandi' });

    const bySchool = await list(`?school_id=${a.school_id}&role=teacher`);
    const bySearch = await list('?search=sip');

    expect(bySchool.body.data.users.map((u) => u.first_name)).toEqual(['Naledi']);
    expect(bySearch.body.data.users.map((u) => u.first_name)).toEqual(['Sipho']);
  });
});

describe('inviting staff', () => {
  it('invites a teacher to an active school', async () => {
    const school = await createSchool();

    const res = await invite({
      first_name: 'Lerato',
      last_name: 'Mokoena',
      email: 'lerato@school.co.za',
      role: 'teacher',
      school_id: school.school_id,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ role: 'teacher', school_id: school.school_id });
    expect(res.body.data.invite.link).toContain('&invite=1');
  });

  it('only invites school admins and teachers, into an active school', async () => {
    const inactive = await createSchool({ is_active: false });
    const base = { first_name: 'A', last_name: 'B', email: 'a@b.co.za' };

    const learner = await invite({ ...base, role: 'learner', school_id: inactive.school_id });
    const superAdminRole = await invite({ ...base, role: 'super_admin', school_id: inactive.school_id });
    const closedSchool = await invite({ ...base, role: 'teacher', school_id: inactive.school_id });

    expect(learner.status).toBe(400);
    expect(superAdminRole.status).toBe(400);
    expect(closedSchool.status).toBe(400);
    expect(closedSchool.body.message).toBe('Choose an active school');
  });
});

describe('managing an account', () => {
  it('edits contact details and moves a teacher to another school', async () => {
    const teacher = await createUser({ role: 'teacher' });
    const other = await createSchool();

    const res = await request(app)
      .put(`/api/super-admin/users/${teacher.user_id}`)
      .set(headers)
      .send({ phone: '082 123 4567', school_id: other.school_id, role: 'super_admin' });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ phone: '082 123 4567', school_id: other.school_id, role: 'teacher' });
  });

  it('can edit someone at an inactive school without moving them', async () => {
    const closed = await createSchool({ is_active: false });
    const teacher = await createUser({ role: 'teacher', school_id: closed.school_id });

    const res = await request(app)
      .put(`/api/super-admin/users/${teacher.user_id}`)
      .set(headers)
      .send({ first_name: 'Renamed', school_id: closed.school_id });

    expect(res.status).toBe(200);
    expect(res.body.data.user.first_name).toBe('Renamed');
  });

  it('refuses an email already used by someone else', async () => {
    const teacher = await createUser({ role: 'teacher' });
    await createUser({ email: 'taken@school.co.za' });

    const res = await request(app)
      .put(`/api/super-admin/users/${teacher.user_id}`)
      .set(headers)
      .send({ email: 'taken@school.co.za' });

    expect(res.status).toBe(409);
  });

  it('cannot manage super admin accounts through this API', async () => {
    const res = await request(app)
      .patch(`/api/super-admin/users/${superAdmin.user_id}/status`)
      .set(headers)
      .send({ is_active: false });

    expect(res.status).toBe(404);
  });

  it('deactivates and reactivates staff', async () => {
    const teacher = await createUser({ role: 'teacher' });

    const off = await request(app)
      .patch(`/api/super-admin/users/${teacher.user_id}/status`)
      .set(headers)
      .send({ is_active: false });
    const blocked = await request(app).get('/api/auth/profile').set(authHeader(teacher));
    const on = await request(app)
      .patch(`/api/super-admin/users/${teacher.user_id}/status`)
      .set(headers)
      .send({ is_active: true });

    expect(off.body.data.user.is_active).toBe(false);
    expect(blocked.status).toBe(401);
    expect(on.body.data.user.is_active).toBe(true);
  });
});

describe('account links', () => {
  it('re-sends an invitation to someone who has never signed in', async () => {
    const teacher = await createUser({ role: 'teacher' });

    const res = await request(app).post(`/api/super-admin/users/${teacher.user_id}/account-link`).set(headers);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ kind: 'invite', expiresIn: '7 days', emailSent: false });
  });

  it('sends a 24-hour reset link to someone who has signed in before', async () => {
    const teacher = await createUser({ role: 'teacher' });
    await pool.query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [teacher.user_id]);

    const res = await request(app).post(`/api/super-admin/users/${teacher.user_id}/account-link`).set(headers);
    const token = new URL(res.body.data.link).searchParams.get('token');
    const reset = await request(app).post('/api/auth/reset-password').send({ token, password: 'FreshPass123' });

    expect(res.body.data).toMatchObject({ kind: 'reset', expiresIn: '24 hours' });
    expect(res.body.data.link).not.toContain('invite=1');
    expect(reset.status).toBe(200);
  });

  it('refuses links for deactivated accounts', async () => {
    const teacher = await createUser({ role: 'teacher', is_active: false });

    const res = await request(app).post(`/api/super-admin/users/${teacher.user_id}/account-link`).set(headers);

    expect(res.status).toBe(400);
  });
});
