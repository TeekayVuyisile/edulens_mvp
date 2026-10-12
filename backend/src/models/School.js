import crypto from 'crypto';
import pool from '../config/database.js';
import { buildUpdateSet } from '../db/sql.js';

// Columns a caller may change through update(); everything else is ignored.
const UPDATABLE_COLUMNS = [
  'school_name', 'contact_email', 'contact_phone', 'address', 'city', 'province', 'country',
];

const PG_UNIQUE_VIOLATION = '23505';

/** Short readable code from the school's initials, e.g. "Pescod High School" → "PHS4821". */
export const generateSchoolCode = (schoolName) => {
  const initials = schoolName
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z]/gi, '')[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 4) || 'SCH';
  return `${initials}${crypto.randomInt(1000, 10000)}`;
};

// Per-school counts used by the list and detail views.
const SCHOOL_COUNTS = `
  (SELECT COUNT(*)::int FROM users u
     WHERE u.school_id = s.school_id AND u.role = 'school_admin' AND u.is_active) AS admin_count,
  (SELECT COUNT(*)::int FROM users u
     WHERE u.school_id = s.school_id AND u.role = 'teacher' AND u.is_active) AS teacher_count,
  (SELECT COUNT(*)::int FROM learners l
     WHERE l.school_id = s.school_id AND l.academic_status = 'active') AS learner_count,
  (SELECT COUNT(*)::int FROM classes c
     WHERE c.school_id = s.school_id AND c.is_active) AS class_count
`;

class School {
  /** Creates a school with a generated unique code (retries on the rare collision). */
  static async create(data) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO schools (
             school_name, school_code, contact_email, contact_phone,
             address, city, province, country
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            data.school_name,
            generateSchoolCode(data.school_name),
            data.contact_email,
            data.contact_phone || null,
            data.address || null,
            data.city || null,
            data.province || null,
            data.country || 'South Africa',
          ]
        );
        return rows[0];
      } catch (error) {
        const codeTaken = error.code === PG_UNIQUE_VIOLATION && error.constraint === 'schools_school_code_key';
        if (!codeTaken) throw error;
      }
    }
    throw new Error('Could not generate a unique school code');
  }

  /**
   * Paginated list with per-school counts, plus totals for the status filter.
   * status: 'active' | 'inactive' | 'no_admin' | undefined (all)
   */
  static async list({ search, status, page = 1, limit = 20 } = {}) {
    const conditions = [];
    const values = [];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(
        `(s.school_name ILIKE $${values.length} OR s.school_code ILIKE $${values.length} OR s.city ILIKE $${values.length})`
      );
    }
    if (status === 'active') conditions.push('s.is_active');
    if (status === 'inactive') conditions.push('NOT s.is_active');
    if (status === 'no_admin') {
      conditions.push(
        `NOT EXISTS (SELECT 1 FROM users u WHERE u.school_id = s.school_id AND u.role = 'school_admin' AND u.is_active)`
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const [listResult, countResult, totalsResult] = await Promise.all([
      pool.query(
        `SELECT s.*, ${SCHOOL_COUNTS}
         FROM schools s
         ${where}
         ORDER BY s.school_name ASC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM schools s ${where}`, values),
      // Totals ignore the status filter (they label the filter tabs) but respect search.
      pool.query(
        `SELECT
           COUNT(*)::int AS all,
           COUNT(*) FILTER (WHERE s.is_active)::int AS active,
           COUNT(*) FILTER (WHERE NOT s.is_active)::int AS inactive,
           COUNT(*) FILTER (WHERE NOT EXISTS (
             SELECT 1 FROM users u WHERE u.school_id = s.school_id AND u.role = 'school_admin' AND u.is_active
           ))::int AS no_admin
         FROM schools s
         ${search ? 'WHERE (s.school_name ILIKE $1 OR s.school_code ILIKE $1 OR s.city ILIKE $1)' : ''}`,
        search ? [values[0]] : []
      ),
    ]);

    const total = countResult.rows[0].total;
    return {
      schools: listResult.rows,
      counts: totalsResult.rows[0],
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  static async getById(schoolId) {
    const { rows } = await pool.query(
      `SELECT s.*, ${SCHOOL_COUNTS} FROM schools s WHERE s.school_id = $1`,
      [schoolId]
    );
    return rows[0];
  }

  /** Staff with the school admin role, including invitations not yet accepted. */
  static async getAdmins(schoolId) {
    const { rows } = await pool.query(
      `SELECT user_id, email, first_name, last_name, phone, is_active, last_login, created_at
       FROM users
       WHERE school_id = $1 AND role = 'school_admin'
       ORDER BY is_active DESC, first_name, last_name`,
      [schoolId]
    );
    return rows;
  }

  static async update(schoolId, data) {
    const { setClause, values, nextParam } = buildUpdateSet(data, UPDATABLE_COLUMNS);
    if (!setClause) return School.getById(schoolId);

    const { rows } = await pool.query(
      `UPDATE schools SET ${setClause}, updated_at = CURRENT_TIMESTAMP
       WHERE school_id = $${nextParam}
       RETURNING *`,
      [...values, schoolId]
    );
    return rows[0];
  }

  static async setActive(schoolId, isActive) {
    const { rows } = await pool.query(
      `UPDATE schools SET is_active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE school_id = $2
       RETURNING *`,
      [isActive, schoolId]
    );
    return rows[0];
  }

  /**
   * Deletes a school only if nothing has been set up in it yet. A school with
   * users, classes or learners must be deactivated instead, because deleting it
   * would cascade away its classes, learners and marks.
   * @returns {{ deleted: boolean, dependents?: { users: number, classes: number, learners: number } }}
   */
  static async deleteIfEmpty(schoolId) {
    const { rows } = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM users WHERE school_id = $1) AS users,
         (SELECT COUNT(*)::int FROM classes WHERE school_id = $1) AS classes,
         (SELECT COUNT(*)::int FROM learners WHERE school_id = $1) AS learners`,
      [schoolId]
    );
    const dependents = rows[0];
    if (dependents.users + dependents.classes + dependents.learners > 0) {
      return { deleted: false, dependents };
    }
    await pool.query('DELETE FROM schools WHERE school_id = $1', [schoolId]);
    return { deleted: true };
  }

  // Get school statistics
  static async getStatistics(schoolId) {
    const { rows } = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM assessments a JOIN classes c ON a.class_id = c.class_id
            WHERE c.school_id = $1 AND c.academic_year = EXTRACT(YEAR FROM CURRENT_DATE))::int AS assessments,
         (SELECT ROUND(AVG(g.percentage), 1) FROM grades g
            JOIN assessments a ON g.assessment_id = a.assessment_id
            JOIN classes c ON a.class_id = c.class_id
            WHERE c.school_id = $1
              AND c.academic_year = EXTRACT(YEAR FROM CURRENT_DATE)
              AND g.percentage IS NOT NULL) AS average_score`,
      [schoolId]
    );
    return {
      assessmentsThisYear: rows[0].assessments,
      averageScore: rows[0].average_score === null ? null : Number(rows[0].average_score),
    };
  }
}

export default School;
