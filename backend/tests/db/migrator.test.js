import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, it, expect } from 'vitest';
import pool from '../../src/config/database.js';
import { runMigrations, MIGRATIONS_DIR } from '../../src/db/migrator.js';

const silent = { log: () => {} };

const appliedNames = async () =>
  (await pool.query('SELECT name FROM schema_migrations ORDER BY name')).rows.map((r) => r.name);

describe('runMigrations', () => {
  let tmpDir;

  afterEach(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  });

  it('records every migration file applied by global setup', async () => {
    const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

    expect(await appliedNames()).toEqual(files);
  });

  it('is a no-op when the database is already up to date', async () => {
    expect(await runMigrations(pool, silent)).toEqual([]);
  });

  it('baselines a database created by the old one-shot schema script', async () => {
    await pool.query('DELETE FROM schema_migrations');

    // Re-running 001 on top of existing tables would throw; baselining must skip it.
    await expect(runMigrations(pool, silent)).resolves.toEqual([]);
    expect(await appliedNames()).toContain('001_initial_schema.sql');
  });

  it('rolls back a failing migration and does not record it', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edulens-migrations-'));
    await fs.writeFile(path.join(tmpDir, '001_initial_schema.sql'), '-- already applied');
    await fs.writeFile(
      path.join(tmpDir, '900_broken.sql'),
      'CREATE TABLE phase0_should_not_exist (id INT); SELECT * FROM no_such_table;'
    );

    await expect(runMigrations(pool, { ...silent, dir: tmpDir })).rejects.toThrow(
      /Migration 900_broken\.sql failed/
    );

    const { rows } = await pool.query("SELECT to_regclass('public.phase0_should_not_exist') AS oid");
    expect(rows[0].oid).toBeNull();
    expect(await appliedNames()).not.toContain('900_broken.sql');
  });
});
