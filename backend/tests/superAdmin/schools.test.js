import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/database.js';
import { generateSchoolCode } from '../../src/models/School.js';
import { resetDb } from '../helpers/db.js';
import { authHeader, createClass, createSchool, createUser } from '../helpers/factories.js';

let headers;

beforeEach(async () => {
  await resetDb();
  headers = authHeader(await createUser({ role: 'super_admin' }));
});

const api = {
  list: (query = '') => request(app).get(`/api/super-admin/schools${query}`).set(headers),
  create: (body) => request(app).post('/api/super-admin/schools').set(headers).send(body),
  get: (id) => request(app).get(`/api/super-admin/schools/${id}`).set(headers),
  update: (id, body) => request(app).put(`/api/super-admin/schools/${id}`).set(headers).send(body),
  status: (id, is_active) => request(app).patch(`/api/super-admin/schools/${id}/status`).set(headers).send({ is_active }),
  remove: (id) => request(app).delete(`/api/super-admin/schools/${id}`).set(headers),
  invite: (id, body) => request(app).post(`/api/super-admin/schools/${id}/admins`).set(headers).send(body),
};

describe('creating schools', () => {
  it('creates a school with a code built from its initials', async () => {
    const res = await api.create({
      school_name: 'Pescod Primary School',
      contact_email: 'Office@Pescod.co.za',
      province: 'Northern Cape',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.school).toMatchObject({
      school_name: 'Pescod Primary School',
      contact_email: 'office@pescod.co.za',
      province: 'Northern Cape',
      country: 'South Africa',
      is_active: true,
    });
    expect(res.body.data.school.school_code).toMatch(/^PPS\d{4}$/);
  });

  it('gives schools created at the same moment different codes', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => api.create({ school_name: `Same Name ${i}`, contact_email: `s${i}@x.co.za` }))
    );

    expect(results.every((r) => r.status === 201)).toBe(true);
    const codes = results.map((r) => r.body.data.school.school_code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('validates required fields, email, phone and province', async () => {
    const res = await api.create({ contact_email: 'nope', contact_phone: 'abc', province: 'Atlantis' });

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.path).sort()).toEqual(
      ['contact_email', 'contact_phone', 'province', 'school_name'].sort()
    );
  });

  it('builds codes from initials and falls back for names without letters', () => {
    expect(generateSchoolCode('Flaming Primary School')).toMatch(/^FPS\d{4}$/);
    expect(generateSchoolCode('123')).toMatch(/^SCH\d{4}$/);
  });
});

describe('listing schools', () => {
  it('returns every school (not just the first 20) when paging through', async () => {
    for (let i = 0; i < 25; i += 1) await createSchool({ school_name: `School ${String(i).padStart(2, '0')}` });

    const first = await api.list('?limit=20');
    const second = await api.list('?limit=20&page=2');

    expect(first.body.data.schools).toHaveLength(20);
    expect(second.body.data.schools).toHaveLength(5);
    expect(first.body.data.pagination).toMatchObject({ total: 25, totalPages: 2 });
  });

  it('filters by status and reports counts for each filter', async () => {
    const withAdmin = await createSchool({ school_name: 'Has Admin' });
    await createUser({ role: 'school_admin', school_id: withAdmin.school_id });
    await createSchool({ school_name: 'No Admin' });
    await createSchool({ school_name: 'Closed', is_active: false });

    const all = await api.list();
    const noAdmin = await api.list('?status=no_admin');
    const inactive = await api.list('?status=inactive');

    expect(all.body.data.counts).toEqual({ all: 3, active: 2, inactive: 1, no_admin: 2 });
    expect(noAdmin.body.data.schools.map((s) => s.school_name).sort()).toEqual(['Closed', 'No Admin']);
    expect(inactive.body.data.schools.map((s) => s.school_name)).toEqual(['Closed']);
    expect(all.body.data.schools.find((s) => s.school_name === 'Has Admin').admin_count).toBe(1);
  });

  it('searches by name, code or city', async () => {
    await createSchool({ school_name: 'Kimberley Junior', school_code: 'KJ1' });
    await createSchool({ school_name: 'Other', school_code: 'OT1' });

    const res = await api.list('?search=kimber');

    expect(res.body.data.schools.map((s) => s.school_name)).toEqual(['Kimberley Junior']);
  });
});

describe('school details', () => {
  it('returns the school with admins, curricula and stats', async () => {
    const school = await createSchool();
    await createUser({ role: 'school_admin', school_id: school.school_id, first_name: 'Ayanda' });

    const res = await api.get(school.school_id);

    expect(res.status).toBe(200);
    expect(res.body.data.admins).toHaveLength(1);
    expect(res.body.data.admins[0].first_name).toBe('Ayanda');
    expect(res.body.data.curricula).toEqual([]);
    expect(res.body.data.stats).toEqual({ assessmentsThisYear: 0, averageScore: null });
  });

  it('404s for an unknown school', async () => {
    const res = await api.get('00000000-0000-4000-8000-000000000000');

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('School not found');
  });

  it('updates editable fields only', async () => {
    const school = await createSchool();

    const res = await api.update(school.school_id, { city: 'Kimberley', school_code: 'HACKED', is_active: false });

    expect(res.status).toBe(200);
    expect(res.body.data.school).toMatchObject({ city: 'Kimberley', school_code: school.school_code, is_active: true });
  });
});

describe('activating and deleting', () => {
  it('deactivates a school, which stops its staff signing in', async () => {
    const school = await createSchool();
    const admin = await createUser({ role: 'school_admin', school_id: school.school_id });

    const res = await api.status(school.school_id, false);
    const staffRequest = await request(app).get('/api/school-admin/dashboard').set(authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.school.is_active).toBe(false);
    expect(staffRequest.status).toBe(401);
  });

  it('requires a real boolean for status', async () => {
    const school = await createSchool();

    const res = await api.status(school.school_id, 'nope');

    expect(res.status).toBe(400);
  });

  it('deletes an empty school', async () => {
    const school = await createSchool();

    const res = await api.remove(school.school_id);

    expect(res.status).toBe(200);
    expect((await pool.query('SELECT 1 FROM schools WHERE school_id = $1', [school.school_id])).rows).toHaveLength(0);
  });

  it('refuses to delete a school that has classes or staff, even inactive ones', async () => {
    const school = await createSchool();
    await createClass({ school_id: school.school_id });
    await createUser({ role: 'teacher', school_id: school.school_id, is_active: false });

    const res = await api.remove(school.school_id);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/deactivate it instead/i);
    expect(res.body.dependents).toEqual({ users: 1, classes: 1, learners: 0 });
  });
});

describe('inviting a school admin', () => {
  it('creates the account and returns a single-use invitation link', async () => {
    const school = await createSchool({ school_name: 'Galeshewe Primary' });

    const res = await api.invite(school.school_id, {
      first_name: 'Ayanda',
      last_name: 'Dlamini',
      email: 'Ayanda@Galeshewe.co.za',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({
      email: 'ayanda@galeshewe.co.za',
      role: 'school_admin',
      school_id: school.school_id,
      last_login: null,
    });
    const { link, emailSent, expiresIn } = res.body.data.invite;
    expect(link).toMatch(/^http:\/\/localhost:5173\/reset-password\?token=[0-9a-f]{64}&invite=1$/);
    expect(emailSent).toBe(false); // SMTP is off in tests
    expect(expiresIn).toBe('7 days');
  });

  it('lets the invited admin set a password with the link and sign in', async () => {
    const school = await createSchool();
    const invite = await api.invite(school.school_id, {
      first_name: 'Ayanda',
      last_name: 'Dlamini',
      email: 'ayanda@school.co.za',
    });
    const token = new URL(invite.body.data.invite.link).searchParams.get('token');

    const reset = await request(app).post('/api/auth/reset-password').send({ token, password: 'MyNewPass123' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ayanda@school.co.za', password: 'MyNewPass123' });

    expect(reset.status).toBe(200);
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('school_admin');
  });

  it('rejects an email that is already in use', async () => {
    const school = await createSchool();
    await createUser({ email: 'taken@school.co.za' });

    const res = await api.invite(school.school_id, { first_name: 'A', last_name: 'B', email: 'TAKEN@school.co.za' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Someone already uses this email address');
  });
});
