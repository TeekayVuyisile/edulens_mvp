import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app.js';
import pool from '../../src/config/database.js';
import { seedDemo } from '../../src/config/seedDemo.js';
import { resetDb } from '../helpers/db.js';
import { createUser } from '../helpers/factories.js';

const demoLogin = (account) => request(app).post('/api/auth/demo-login').send({ account });

describe('one-click demo sign-in', () => {
  beforeEach(async () => {
    await resetDb();
    process.env.DEMO_LOGIN = 'true';
  });
  afterEach(() => {
    delete process.env.DEMO_LOGIN;
  });

  it('lists the demo accounts without their emails', async () => {
    const res = await request(app).get('/api/auth/demo');

    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(true);
    expect(res.body.data.accounts.map((a) => a.key)).toEqual(['school_admin', 'teacher', 'parent']);
    expect(JSON.stringify(res.body)).not.toContain('@');
  });

  it('signs in to a demo account without a password and marks the session as a demo', async () => {
    await seedDemo();

    const res = await demoLogin('teacher');

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: 'demo.teacher@example.com', role: 'teacher', is_demo: true });
    expect(res.body.data.user).not.toHaveProperty('password_hash');
    const claims = jwt.verify(res.body.data.token, process.env.JWT_SECRET);
    expect(claims.role).toBe('teacher');

    const profile = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${res.body.data.token}`);
    expect(profile.body.data.user.is_demo).toBe(true);
  });

  it('brings back a demo account that a visitor deactivated', async () => {
    await seedDemo();
    await pool.query("UPDATE users SET is_active = false WHERE email = 'demo.teacher@example.com'");

    const res = await demoLogin('teacher');

    expect(res.status).toBe(200);
    const { rows } = await pool.query("SELECT is_active FROM users WHERE email = 'demo.teacher@example.com'");
    expect(rows[0].is_active).toBe(true);
  });

  it('only signs in to the listed demo accounts', async () => {
    await seedDemo();

    expect((await demoLogin('teacher2')).status).toBe(400);
    expect((await demoLogin('super_admin')).status).toBe(400);
    expect((await demoLogin('demo.admin@example.com')).status).toBe(400);
  });

  it('explains when the demo school has not been created', async () => {
    const res = await demoLogin('parent');

    expect(res.status).toBe(503);
  });

  it('is switched off unless DEMO_LOGIN=true', async () => {
    await seedDemo();
    delete process.env.DEMO_LOGIN;

    expect((await demoLogin('teacher')).status).toBe(404);
    const list = await request(app).get('/api/auth/demo');
    expect(list.body.data).toEqual({ enabled: false, accounts: [] });
  });

  it('marks only demo accounts as demo on a normal sign-in', async () => {
    const user = await createUser({ role: 'teacher' });

    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: user.password });

    expect(res.body.data.user.is_demo).toBe(false);
  });
});
