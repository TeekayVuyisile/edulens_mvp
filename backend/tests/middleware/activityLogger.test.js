import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { buildLogEntry, redact } from '../../src/middleware/activityLogger.js';

const fakeReq = (method, originalUrl, body) => ({
  method,
  originalUrl,
  body,
  ip: '127.0.0.1',
  user: { userId: 'u1', schoolId: 's1' },
  get: () => 'vitest',
});

describe('redact', () => {
  it('hides credential fields at any depth', () => {
    const input = {
      email: 'a@b.co.za',
      password: 'secret',
      nested: { new_password: 'x', items: [{ token: 't', name: 'ok' }] },
    };

    expect(redact(input)).toEqual({
      email: 'a@b.co.za',
      password: '[REDACTED]',
      nested: { new_password: '[REDACTED]', items: [{ token: '[REDACTED]', name: 'ok' }] },
    });
    expect(input.password).toBe('secret'); // the request body itself is untouched
  });
});

describe('buildLogEntry', () => {
  it('skips page views', () => {
    expect(buildLogEntry(fakeReq('GET', '/api/super-admin/schools'), { statusCode: 200 }, 5)).toBeNull();
  });

  it('records the full path (not the router-relative one) and redacts the body', () => {
    const entry = buildLogEntry(
      fakeReq('POST', '/api/super-admin/users?x=1', { email: 'a@b.co.za', password: 'p' }),
      { statusCode: 201 },
      12
    );

    expect(entry.action_type).toBe('POST /api/super-admin/users');
    expect(entry.action_details.body).toEqual({ email: 'a@b.co.za', password: '[REDACTED]' });
    expect(entry).toMatchObject({ user_id: 'u1', school_id: 's1' });
  });

  it('never stores bodies sent to auth endpoints', () => {
    const entry = buildLogEntry(
      fakeReq('POST', '/api/auth/login', { email: 'a@b.co.za', password: 'p' }),
      { statusCode: 200 },
      3
    );

    expect(entry.action_details.body).toBeNull();
  });
});

describe('error responses', () => {
  it('answers malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Request body is not valid JSON');
  });
});
