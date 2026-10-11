import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const { Pool } = pg;

// Neon (and most hosted Postgres) requires TLS. A DATABASE_URL with
// `?sslmode=require` enables it automatically; DB_SSL=true forces it otherwise.
const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined;

export const getConnectionConfig = (overrides = {}) => {
  const base = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      };

  return { ...base, ...(ssl && { ssl }), ...overrides };
};

const pool = new Pool({
  ...getConnectionConfig(),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export default pool;
