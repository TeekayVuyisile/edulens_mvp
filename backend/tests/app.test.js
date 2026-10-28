import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app, { isUnlimited } from '../src/app.js';

describe('app', () => {
  it('GET /api/health reports the API is up', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'success', environment: 'test' });
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      status: 'error',
      message: 'Route not found',
      path: '/api/does-not-exist',
    });
  });

  it('rate-limits API calls but not the health check or page assets', () => {
    expect(isUnlimited('/api/health')).toBe(true);
    expect(isUnlimited('/assets/index.js')).toBe(true);
    expect(isUnlimited('/login')).toBe(true);
    expect(isUnlimited('/api/auth/login')).toBe(false);
    expect(isUnlimited('/api/learners')).toBe(false);
  });
});
