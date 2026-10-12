import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/database.js';
import { resetDb } from '../helpers/db.js';
import { assignTeacher, authHeader, createClass, createUser } from '../helpers/factories.js';

let admin;
let headers;

beforeEach(async () => {
  await resetDb();
  admin = await createUser({ role: 'school_admin' });
  headers = authHeader(admin);
});

const api = (method, path) => request(app)[method](`/api/school-admin${path}`).set(headers);

describe('teacher list', () => {
  it("lists only this school's teachers, with their classes", async () => {
    const teacher = await createUser({ role: 'teacher', school_id: admin.school_id, first_name: 'Naledi' });
    await createUser({ role: 'teacher' }); // another school
    await createUser({ role: 'school_admin', school_id: admin.school_id });
    const klass = await createClass({ school_id: admin.school_id, class_name: 'Grade 1A' });
    await assignTeacher(teacher, klass);

    const res = await api('get', '/teachers');

    expect(res.status).toBe(200);
    expect(res.body.data.teachers).toHaveLength(1);
    expect(res.body.data.teachers[0]).toMatchObject({
      first_name: 'Naledi',
      classes: [{ class_name: 'Grade 1A', is_primary: true }],
    });
    expect(res.body.data.counts).toEqual({ all: 1, active: 0, pending: 1, inactive: 0 });
  });

  it('filters by status and search text', async () => {
    const signedIn = await createUser({ role: 'teacher', school_id: admin.school_id, first_name: 'Sipho' });
    await pool.query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [signedIn.user_id]);
    await createUser({ role: 'teacher', school_id: admin.school_id, first_name: 'Thandi' });

    const active = await api('get', '/teachers?status=active');
    const search = await api('get', '/teachers?search=than');

    expect(active.body.data.teachers.map((t) => t.first_name)).toEqual(['Sipho']);
    expect(search.body.data.teachers.map((t) => t.first_name)).toEqual(['Thandi']);
  });
});

describe('inviting teachers', () => {
  it('creates the teacher in this school and returns an invitation link', async () => {
    const res = await api('post', '/teachers').send({
      first_name: 'Lerato',
      last_name: 'Mokoena',
      email: 'Lerato@Example.com',
      school_id: '5d0c0b1e-1111-4222-8333-444455556666', // ignored
    });

    expect(res.status).toBe(201);
    expect(res.body.data.teacher).toMatchObject({ email: 'lerato@example.com', role: 'teacher', school_id: admin.school_id });
    expect(res.body.data.invite.link).toMatch(/\/reset-password\?token=\w+&invite=1$/);
    expect(res.body.data.invite.emailSent).toBe(false);
  });

  it('reports a clash with an existing email address as 409', async () => {
    await createUser({ role: 'teacher', email: 'taken@example.com' });

    const res = await api('post', '/teachers').send({ first_name: 'A', last_name: 'B', email: 'taken@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already uses this email/);
  });

  it('explains missing fields per field', async () => {
    const res = await api('post', '/teachers').send({ email: 'nope' });

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.path).sort()).toEqual(['email', 'first_name', 'last_name']);
  });
});

describe('managing a teacher', () => {
  it('updates contact details but not role or school', async () => {
    const teacher = await createUser({ role: 'teacher', school_id: admin.school_id });

    const res = await api('put', `/teachers/${teacher.user_id}`).send({
      first_name: 'Renamed',
      role: 'school_admin',
      school_id: null,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.teacher).toMatchObject({ first_name: 'Renamed', role: 'teacher', school_id: admin.school_id });
  });

  it('deactivates and reactivates a teacher', async () => {
    const teacher = await createUser({ role: 'teacher', school_id: admin.school_id });

    const off = await api('patch', `/teachers/${teacher.user_id}/status`).send({ is_active: false });
    const on = await api('patch', `/teachers/${teacher.user_id}/status`).send({ is_active: true });

    expect(off.body.data.teacher.is_active).toBe(false);
    expect(on.body.data.teacher.is_active).toBe(true);
  });

  it('issues an invite before the first sign-in and a reset link after', async () => {
    const teacher = await createUser({ role: 'teacher', school_id: admin.school_id });

    const first = await api('post', `/teachers/${teacher.user_id}/account-link`);
    await pool.query('UPDATE users SET last_login = NOW() WHERE user_id = $1', [teacher.user_id]);
    const later = await api('post', `/teachers/${teacher.user_id}/account-link`);

    expect(first.body.data.kind).toBe('invite');
    expect(later.body.data.kind).toBe('reset');
  });

  it("can't see or change teachers from another school", async () => {
    const outsider = await createUser({ role: 'teacher' });

    const responses = await Promise.all([
      api('get', `/teachers/${outsider.user_id}`),
      api('put', `/teachers/${outsider.user_id}`).send({ first_name: 'Hacked' }),
      api('patch', `/teachers/${outsider.user_id}/status`).send({ is_active: false }),
      api('post', `/teachers/${outsider.user_id}/account-link`),
    ]);

    expect(responses.map((r) => r.status)).toEqual([404, 404, 404, 404]);
    const { rows } = await pool.query('SELECT first_name, is_active FROM users WHERE user_id = $1', [outsider.user_id]);
    expect(rows[0]).toEqual({ first_name: 'Test', is_active: true });
  });

  it('does not treat another school admin as a teacher', async () => {
    const colleague = await createUser({ role: 'school_admin', school_id: admin.school_id });

    const res = await api('get', `/teachers/${colleague.user_id}`);

    expect(res.status).toBe(404);
  });
});
