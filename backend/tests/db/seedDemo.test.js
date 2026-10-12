import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/database.js';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, seedDemo } from '../../src/config/seedDemo.js';
import { resetDb } from '../helpers/db.js';

describe('demo seed', () => {
  beforeEach(resetDb);

  it('creates a demo school whose accounts can all sign in, and is safe to run twice', async () => {
    const first = await seedDemo();
    const second = await seedDemo();

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    for (const account of DEMO_ACCOUNTS) {
      const res = await request(app).post('/api/auth/login').send({ email: account.email, password: DEMO_PASSWORD });
      expect(res.status, account.email).toBe(200);
    }
    const { rows: [counts] } = await pool.query(`
      SELECT (SELECT COUNT(*)::int FROM classes) AS classes,
             (SELECT COUNT(*)::int FROM learners) AS learners,
             (SELECT COUNT(*)::int FROM grades) AS marks,
             (SELECT COUNT(*)::int FROM guardian_links) AS links`);
    expect(counts).toMatchObject({ classes: 4, learners: 25, links: 2 });
    expect(counts.marks).toBeGreaterThan(100);
  });

  it('can start over with --reset', async () => {
    await seedDemo();

    const again = await seedDemo({ reset: true });

    expect(again.created).toBe(true);
    const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM users WHERE email LIKE 'demo.%'");
    expect(rows[0].n).toBe(DEMO_ACCOUNTS.length);
  });
});
