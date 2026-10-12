import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/database.js';
import { resetDb } from '../helpers/db.js';
import { authHeader, createSchool, createUser } from '../helpers/factories.js';

describe('/api/auth/profile', () => {
  beforeEach(resetDb);

  it('GET returns the signed-in user without secrets', async () => {
    const teacher = await createUser({ role: 'teacher', first_name: 'Thandi' });

    const res = await request(app).get('/api/auth/profile').set(authHeader(teacher));

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({
      user_id: teacher.user_id,
      first_name: 'Thandi',
      role: 'teacher',
    });
    expect(res.body.data.user).not.toHaveProperty('password_hash');
    expect(res.body.data.user).not.toHaveProperty('password_reset_token');
  });

  it('GET requires a token', async () => {
    const res = await request(app).get('/api/auth/profile');

    expect(res.status).toBe(401);
  });

  it('PUT updates name and phone', async () => {
    const teacher = await createUser();

    const res = await request(app)
      .put('/api/auth/profile')
      .set(authHeader(teacher))
      .send({ first_name: ' Lerato ', last_name: 'Mokoena', phone: '0821234567' });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({
      first_name: 'Lerato',
      last_name: 'Mokoena',
      phone: '0821234567',
    });
  });

  it('PUT cannot change role, school or active status', async () => {
    const teacher = await createUser({ role: 'teacher' });
    const otherSchool = await createSchool();

    const res = await request(app)
      .put('/api/auth/profile')
      .set(authHeader(teacher))
      .send({
        first_name: 'Still',
        role: 'super_admin',
        school_id: otherSchool.school_id,
        is_active: false,
      });

    expect(res.status).toBe(200);
    const { rows } = await pool.query('SELECT role, school_id, is_active FROM users WHERE user_id = $1', [
      teacher.user_id,
    ]);
    expect(rows[0]).toEqual({ role: 'teacher', school_id: teacher.school_id, is_active: true });
  });

  it('PUT rejects blank names and empty updates', async () => {
    const teacher = await createUser();

    const blank = await request(app)
      .put('/api/auth/profile')
      .set(authHeader(teacher))
      .send({ first_name: '   ' });
    const empty = await request(app).put('/api/auth/profile').set(authHeader(teacher)).send({});

    expect(blank.status).toBe(400);
    expect(empty.status).toBe(400);
  });

  it('POST /api/auth/logout responds for a signed-in user', async () => {
    const teacher = await createUser();

    const res = await request(app).post('/api/auth/logout').set(authHeader(teacher));

    expect(res.status).toBe(200);
  });
});
