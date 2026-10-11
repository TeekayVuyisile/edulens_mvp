import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app.js';
import pool from '../../src/config/database.js';
import { resetDb } from '../helpers/db.js';
import { createUser } from '../helpers/factories.js';

const login = (body) => request(app).post('/api/auth/login').send(body);

describe('POST /api/auth/login', () => {
  beforeEach(resetDb);

  it('returns a signed token and the user without the password hash', async () => {
    const user = await createUser({ role: 'teacher' });

    const res = await login({ email: user.email, password: user.password });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: user.email, role: 'teacher' });
    expect(res.body.data.user).not.toHaveProperty('password_hash');

    const claims = jwt.verify(res.body.data.token, process.env.JWT_SECRET);
    expect(claims).toMatchObject({
      userId: user.user_id,
      role: 'teacher',
      schoolId: user.school_id,
    });
  });

  it('records the login time', async () => {
    const user = await createUser();

    await login({ email: user.email, password: user.password });

    const { rows } = await pool.query('SELECT last_login FROM users WHERE user_id = $1', [
      user.user_id,
    ]);
    expect(rows[0].last_login).not.toBeNull();
  });

  it('rejects a wrong password with a generic message', async () => {
    const user = await createUser();

    const res = await login({ email: user.email, password: 'not-the-password' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('rejects an unknown email with the same generic message', async () => {
    const res = await login({ email: 'nobody@example.com', password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('rejects a deactivated account', async () => {
    const user = await createUser({ is_active: false });

    const res = await login({ email: user.email, password: user.password });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/deactivated/i);
  });

  it('validates the request body', async () => {
    const res = await login({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors.map((e) => e.path)).toEqual(
      expect.arrayContaining(['email', 'password'])
    );
  });

  // Known bugs, fixed in Phase 1 (auth & security).
  it.todo('accepts Gmail addresses containing dots (normalizeEmail currently strips them)');
});
