import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

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
});
