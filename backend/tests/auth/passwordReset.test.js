import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app.js';
import pool from '../../src/config/database.js';
import emailService from '../../src/services/emailService.js';
import { resetDb } from '../helpers/db.js';
import { createUser } from '../helpers/factories.js';

const GENERIC_MESSAGE = 'If an account exists with this email, you will receive a password reset link';

const forgot = (email) => request(app).post('/api/auth/forgot-password').send({ email });
const reset = (token, password) =>
  request(app).post('/api/auth/reset-password').send({ token, password });
const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

describe('password reset', () => {
  let sendResetEmail;

  beforeEach(async () => {
    await resetDb();
    sendResetEmail = vi.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Requests a reset for `user` and returns the token from the "email". */
  const requestToken = async (user) => {
    await forgot(user.email);
    return sendResetEmail.mock.calls.at(-1)[1];
  };

  it('gives the same answer whether or not the email exists', async () => {
    const user = await createUser();

    const known = await forgot(user.email);
    const unknown = await forgot('nobody@example.com');

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body.message).toBe(GENERIC_MESSAGE);
    expect(unknown.body.message).toBe(GENERIC_MESSAGE);
    expect(sendResetEmail).toHaveBeenCalledTimes(1);
  });

  it('does not send reset emails to deactivated or learner accounts', async () => {
    const inactive = await createUser({ is_active: false });
    const learner = await createUser({ role: 'learner' });

    await forgot(inactive.email);
    await forgot(learner.email);

    expect(sendResetEmail).not.toHaveBeenCalled();
  });

  it('still answers normally when the email server fails', async () => {
    const user = await createUser();
    sendResetEmail.mockRejectedValueOnce(new Error('SMTP down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await forgot(user.email);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(GENERIC_MESSAGE);
  });

  it('stores only a hash of the token', async () => {
    const user = await createUser();

    const token = await requestToken(user);

    const { rows } = await pool.query('SELECT password_reset_token FROM users WHERE user_id = $1', [
      user.user_id,
    ]);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].password_reset_token).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].password_reset_token).not.toBe(token);
  });

  it('resets the password with a valid token, once', async () => {
    const user = await createUser();
    const token = await requestToken(user);

    const first = await reset(token, 'BrandNewPass1');
    const second = await reset(token, 'AnotherPass22');

    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
    expect((await login(user.email, user.password)).status).toBe(401);
    expect((await login(user.email, 'BrandNewPass1')).status).toBe(200);
  });

  it('rejects an expired token', async () => {
    const user = await createUser();
    const token = await requestToken(user);
    await pool.query(
      "UPDATE users SET password_reset_expires = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE user_id = $1",
      [user.user_id]
    );

    const res = await reset(token, 'BrandNewPass1');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid or expired reset token');
  });

  it('rejects an unknown token', async () => {
    const res = await reset('f'.repeat(64), 'BrandNewPass1');

    expect(res.status).toBe(400);
  });

  it(`requires a password of at least 8 characters`, async () => {
    const user = await createUser();
    const token = await requestToken(user);

    const res = await reset(token, 'short');

    expect(res.status).toBe(400);
    expect(res.body.errors[0].path).toBe('password');
  });

  it('signs out sessions issued before the reset, but not new ones', async () => {
    const user = await createUser();
    const oldToken = jwt.sign(
      { userId: user.user_id, role: user.role, iat: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET
    );
    const token = await requestToken(user);

    await reset(token, 'BrandNewPass1');
    const fresh = await login(user.email, 'BrandNewPass1');

    const oldSession = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${oldToken}`);
    const newSession = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${fresh.body.data.token}`);

    expect(oldSession.status).toBe(401);
    expect(oldSession.body.message).toMatch(/sign in again/i);
    // Regression: a TIMESTAMP (not TIMESTAMPTZ) column made this fail on non-UTC servers.
    expect(newSession.status).toBe(200);
  });
});
