import pg from 'pg';
import { getConnectionConfig } from '../../src/config/database.js';
import { runMigrations } from '../../src/db/migrator.js';

// Runs once before the whole suite: recreate the test database from scratch and
// apply every migration, so each run starts from the same schema CI and Neon get.
export default async function setup() {
  const testDbName = process.env.DB_NAME;

  const admin = new pg.Client(getConnectionConfig({ database: 'postgres' }));
  await admin.connect();
  try {
    // The name is validated in vitest.config.js, so interpolating it is safe.
    await admin.query(`DROP DATABASE IF EXISTS "${testDbName}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${testDbName}"`);
  } finally {
    await admin.end();
  }

  const pool = new pg.Pool(getConnectionConfig());
  try {
    await runMigrations(pool, { log: () => {} });
  } finally {
    await pool.end();
  }
}
