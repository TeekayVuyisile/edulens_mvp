import pool from '../../src/config/database.js';

/**
 * Empties every application table (keeping schema_migrations) so each test
 * starts from a blank database. Call it in beforeEach.
 */
export const resetDb = async () => {
  const { rows } = await pool.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> 'schema_migrations'
  `);
  if (rows.length === 0) return;

  const tables = rows.map((r) => `"${r.tablename}"`).join(', ');
  await pool.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
};
