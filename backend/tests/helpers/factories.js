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

export const createClass = async ({ school_id, ...overrides } = {}) => {
  const n = next();
  const schoolId = school_id ?? (await createSchool()).school_id;
  const { rows } = await pool.query(
    `INSERT INTO classes (school_id, class_name, grade_level, academic_year, max_capacity)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      schoolId,
      overrides.class_name ?? `Class ${n}`,
      overrides.grade_level ?? '1',
      overrides.academic_year ?? new Date().getFullYear(),
      overrides.max_capacity ?? 30,
    ]
  );
  return rows[0];
};

export const assignTeacher = async (teacher, klass, { is_primary = true } = {}) => {
  await pool.query(
    'INSERT INTO class_teacher_assignments (class_id, teacher_id, is_primary) VALUES ($1, $2, $3)',
    [klass.class_id, teacher.user_id, is_primary]
  );
  if (is_primary) {
    await pool.query('UPDATE classes SET primary_teacher_id = $1 WHERE class_id = $2', [teacher.user_id, klass.class_id]);
  }
};

/** A learner record (learners never sign in, so there is no users row). */
export const createLearner = async ({ klass, school_id, ...overrides } = {}) => {
  const n = next();
  const schoolId = school_id ?? klass?.school_id ?? (await createSchool()).school_id;
  const { rows } = await pool.query(
    `INSERT INTO learners (school_id, current_class_id, first_name, last_name, date_of_birth, gender,
                           admission_number, academic_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      schoolId,
      klass?.class_id ?? null,
      overrides.first_name ?? 'Learner',
      overrides.last_name ?? `Number${n}`,
      overrides.date_of_birth ?? '2019-03-01',
      overrides.gender ?? 'Female',
      overrides.admission_number ?? null,
      overrides.academic_status ?? 'active',
    ]
  );
  return rows[0];
};

/** Records a mark for a learner in an assessment. */
export const createGrade = async ({ assessment, learner, teacher, percentage = 60 }) => {
  const marks = (percentage / 100) * (assessment.total_marks ?? 20);
  await pool.query(
    `INSERT INTO grades (assessment_id, learner_id, marks_obtained, percentage, is_graded, graded_by)
     VALUES ($1, $2, $3, $4, true, $5)`,
    [assessment.assessment_id, learner.learner_id, marks, percentage, teacher?.user_id ?? null]
  );
};

export const createAssessment = async ({ teacher, klass, ...overrides }) => {
  const n = next();
  const { rows } = await pool.query(
    `INSERT INTO assessments (class_id, teacher_id, assessment_name, assessment_type, total_marks, term_number, subject_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      klass.class_id,
      teacher.user_id,
      overrides.assessment_name ?? `Assessment ${n}`,
      overrides.assessment_type ?? 'test',
      overrides.total_marks ?? 20,
      overrides.term_number ?? '1',
      overrides.subject_id ?? null,
    ]
  );
  return rows[0];
};

/** A valid JWT for `user`, signed the same way the login endpoint signs it. */
export const tokenFor = (user) => User.generateToken(user);

export const authHeader = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });
