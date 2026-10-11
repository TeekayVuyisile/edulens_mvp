import bcrypt from 'bcryptjs';
import pool from '../../src/config/database.js';
import User from '../../src/models/User.js';

let sequence = 0;
const next = () => ++sequence;

export const DEFAULT_PASSWORD = 'Password123!';

// Low bcrypt cost keeps the suite fast; production code still uses its own cost.
const hash = (password) => bcrypt.hash(password, 4);

export const createSchool = async (overrides = {}) => {
  const n = next();
  const { rows } = await pool.query(
    `INSERT INTO schools (school_name, school_code, contact_email, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      overrides.school_name ?? `Test School ${n}`,
      overrides.school_code ?? `TST${n}`,
      overrides.contact_email ?? `school${n}@example.com`,
      overrides.is_active ?? true,
    ]
  );
  return rows[0];
};

/**
 * Inserts a user and returns the row plus the plain-text password used.
 * Non-super-admin roles get a school created for them unless school_id is given.
 */
export const createUser = async (overrides = {}) => {
  const n = next();
  const role = overrides.role ?? 'teacher';
  const password = overrides.password ?? DEFAULT_PASSWORD;

  let schoolId = overrides.school_id;
  if (schoolId === undefined && role !== 'super_admin') {
    schoolId = (await createSchool()).school_id;
  }

  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, school_id, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      overrides.email ?? `user${n}@example.com`,
      await hash(password),
      overrides.first_name ?? 'Test',
      overrides.last_name ?? `User${n}`,
      role,
      schoolId ?? null,
      overrides.is_active ?? true,
    ]
  );
  return { ...rows[0], password };
};

/** A valid JWT for `user`, signed the same way the login endpoint signs it. */
export const tokenFor = (user) => User.generateToken(user);

export const authHeader = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });
