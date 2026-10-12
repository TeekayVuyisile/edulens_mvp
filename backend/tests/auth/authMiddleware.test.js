import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app.js';
import pool from '../../src/config/database.js';
import { resetDb } from '../helpers/db.js';
import { authHeader, createUser } from '../helpers/factories.js';

// A super-admin-only endpoint, used to exercise the role guard.
const SUPER_ADMIN_ROUTE = '/api/super-admin/schools';
// A school-admin-only endpoint, used to exercise the school-suspension check.
const SCHOOL_ADMIN_ROUTE = '/api/school-admin/dashboard';

describe('protect() middleware', () => {
  beforeEach(resetDb);

  it('rejects requests without a bearer token', async () => {
    const res = await request(app).get(SUPER_ADMIN_ROUTE);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('No token provided');
  });

  it('rejects a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ userId: 'x', role: 'super_admin' }, 'not-the-secret');

    const res = await request(app)
      .get(SUPER_ADMIN_ROUTE)
      .set('Authorization', `Bearer ${forged}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid token');
  });

  it('rejects an expired token', async () => {
    const admin = await createUser({ role: 'super_admin' });
    const expired = jwt.sign(
      { userId: admin.user_id, role: 'super_admin' },
      process.env.JWT_SECRET,
      { expiresIn: -10 }
    );

    const res = await request(app)
      .get(SUPER_ADMIN_ROUTE)
      .set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Token expired');
  });

  it('allows the required role', async () => {
    const admin = await createUser({ role: 'super_admin' });

    const res = await request(app).get(SUPER_ADMIN_ROUTE).set(authHeader(admin));

    expect(res.status).toBe(200);
  });

  it('forbids other roles', async () => {
    const teacher = await createUser({ role: 'teacher' });

    const res = await request(app).get(SUPER_ADMIN_ROUTE).set(authHeader(teacher));

    expect(res.status).toBe(403);
  });

  it('rejects a user deactivated after their token was issued', async () => {
    const admin = await createUser({ role: 'super_admin' });
    const headers = authHeader(admin);
    await pool.query('UPDATE users SET is_active = false WHERE user_id = $1', [admin.user_id]);

    const res = await request(app).get(SUPER_ADMIN_ROUTE).set(headers);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Account has been deactivated');
  });

  it('rejects users whose school has been suspended', async () => {
    const schoolAdmin = await createUser({ role: 'school_admin' });
    await pool.query('UPDATE schools SET is_active = false WHERE school_id = $1', [
      schoolAdmin.school_id,
    ]);

    const res = await request(app).get(SCHOOL_ADMIN_ROUTE).set(authHeader(schoolAdmin));

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/suspended/i);
  });

  it('signs a user out when an admin changes their password', async () => {
    const admin = await createUser({ role: 'super_admin' });
    const teacher = await createUser({ role: 'teacher' });
    const teacherHeaders = authHeader(teacher);
    // Make the existing token older than the change below.
    await new Promise((r) => setTimeout(r, 1100));

    const change = await request(app)
      .patch(`/api/super-admin/users/${teacher.user_id}/change-password`)
      .set(authHeader(admin))
      .send({ new_password: 'ChangedPass1', confirm_new_password: 'ChangedPass1' });
    const res = await request(app).get('/api/auth/profile').set(teacherHeaders);

    expect(change.status).toBe(200);
    expect(res.status).toBe(401);
  });
});

describe('route id validation', () => {
  beforeEach(resetDb);

  it('rejects a malformed id with 400 instead of a database error', async () => {
    const admin = await createUser({ role: 'super_admin' });

    const res = await request(app).get('/api/super-admin/schools/not-a-uuid').set(authHeader(admin));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid schoolId');
  });

  it('checks authentication before validating ids', async () => {
    const res = await request(app).get('/api/super-admin/schools/not-a-uuid');

    expect(res.status).toBe(401);
  });

  it('no longer exposes the unprotected /api/learner routes', async () => {
    const res = await request(app).get('/api/learner/me/profile');

    expect(res.status).toBe(404);
  });
});
