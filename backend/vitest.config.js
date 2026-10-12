import dotenv from 'dotenv';
import { defineConfig } from 'vitest/config';

// Local runs reuse the DB_HOST/DB_USER/DB_PASSWORD from .env; CI provides them as
// real environment variables, which dotenv never overrides.
dotenv.config({ quiet: true });

const testDbName = process.env.TEST_DB_NAME || 'edulens_lms_test';
if (!/^[a-z0-9_]+_test$/.test(testDbName)) {
  // globalSetup drops and recreates this database, so refuse anything that isn't clearly a test DB.
  throw new Error(`TEST_DB_NAME must be lowercase and end in "_test" (got "${testDbName}")`);
}

Object.assign(process.env, {
  NODE_ENV: 'test',
  DB_NAME: testDbName,
  // Empty (not deleted) so dotenv in src/config/database.js can't re-add a real URL such as Neon's.
  DATABASE_URL: '',
  DB_SSL: process.env.TEST_DB_SSL || 'false',
  JWT_SECRET: process.env.JWT_SECRET || 'test-jwt-secret',
  JWT_EXPIRE: '1h',
  // Never send real email from tests, even if .env has SMTP settings.
  SMTP_HOST: '',
  // Never call the paid AI API from tests; worksheet tests mock the generator.
  OPENAI_API_KEY: '',
  FRONTEND_URL: 'http://localhost:5173',
});

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globalSetup: ['tests/setup/globalSetup.js'],
    setupFiles: ['tests/setup/closePool.js'],
    // All test files share one database, so run them one at a time.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
