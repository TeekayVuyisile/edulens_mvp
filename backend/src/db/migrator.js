import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const MIGRATIONS_DIR = path.resolve(__dirname, '../../../database/migrations');

// Migration files are named NNN_description.sql and applied in filename order.
const MIGRATION_FILE = /^\d+_[\w-]+\.sql$/;

const tableExists = async (client, tableName) => {
  const { rows } = await client.query('SELECT to_regclass($1) AS oid', [`public.${tableName}`]);
  return rows[0].oid !== null;
};

/**
 * Applies every migration in `dir` that is not yet recorded in schema_migrations.
 * Each file runs in its own transaction, so a failing migration leaves the
 * database at the last good version. Safe to run repeatedly.
 *
 * @returns {Promise<string[]>} names of the migrations applied by this run
 */
export const runMigrations = async (pool, { dir = MIGRATIONS_DIR, log = console.log } = {}) => {
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const files = (await fs.readdir(dir)).filter((f) => MIGRATION_FILE.test(f)).sort();
    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.name));

    // Databases created by the old one-shot schema script already contain the
    // initial schema but have no migration history. Record it instead of re-running it.
    if (applied.size === 0 && files.length > 0 && (await tableExists(client, 'users'))) {
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [files[0]]);
      applied.add(files[0]);
      log(`Existing schema detected; marked ${files[0]} as applied`);
    }

    const ran = [];
    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = await fs.readFile(path.join(dir, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${error.message}`, { cause: error });
      }

      ran.push(file);
      log(`Applied ${file}`);
    }

    return ran;
  } finally {
    client.release();
  }
};
