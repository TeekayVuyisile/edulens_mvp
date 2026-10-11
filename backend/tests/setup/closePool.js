import { afterAll } from 'vitest';
import pool from '../../src/config/database.js';

// Each test file gets its own module graph (and therefore its own pool).
afterAll(async () => {
  await pool.end();
});
