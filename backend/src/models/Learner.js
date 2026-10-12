import pool from '../config/database.js';
import { buildUpdateSet } from '../db/sql.js';

// Columns a caller may change through update(); class and status have their own methods.
const UPDATABLE_COLUMNS = [
  'first_name', 'last_name', 'admission_number', 'date_of_birth', 'gender',
  'has_special_needs', 'special_needs_notes', 'medical_notes',
  'guardian_name', 'guardian_email', 'guardian_phone',
];

const CREATE_COLUMNS = ['school_id', 'current_class_id', ...UPDATABLE_COLUMNS];

/** Learners still at the school. 'repeated' learners are current too. */
export const CURRENT_STATUSES = ['active', 'repeated'];
/** Learners who have left: moved away, finished Grade 3 or were archived. */
export const LEFT_STATUSES = ['inactive', 'graduated', 'archived'];

const LIST_COLUMNS = `
  l.learner_id, l.first_name, l.last_name, l.admission_number, l.date_of_birth, l.gender,
  l.academic_status, l.enrollment_date, l.current_class_id, l.has_special_needs,
  l.guardian_name, l.guardian_phone, l.guardian_email, l.created_at,
  c.class_name, c.grade_level, c.academic_year`;

const blankToNull = (value) => (typeof value === 'string' && value.trim() === '' ? null : value);

class Learner {
  /**
   * Adds a learner (no login account) and, when a class is given, records the placement.
   * Pass a transaction client to include it in a larger write.
   */
  static async create(data, client = pool) {
    const columns = CREATE_COLUMNS.filter((column) => data[column] !== undefined);
    const values = columns.map((column) => blankToNull(data[column]));
    const { rows } = await client.query(
      `INSERT INTO learners (${columns.join(', ')})
       VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
       RETURNING *`,
      values
    );
    const learner = rows[0];
    if (learner.current_class_id) await Learner.openPlacement(learner.learner_id, learner.current_class_id, client);
    return learner;
  }

  /**
   * Paged register for one school.
   * status: 'current' (default), 'unplaced' (current, no class), 'left' or 'all'.
   */
  static async list(schoolId, { search, status = 'current', classId, grade, page = 1, limit = 20 } = {}) {
    const conditions = ['l.school_id = $1'];
    const values = [schoolId];
    const add = (sql, value) => {
      values.push(value);
      conditions.push(sql.replaceAll('?', `$${values.length}`));
    };

    if (search) {
      add(
        `(l.first_name ILIKE ? OR l.last_name ILIKE ? OR (l.first_name || ' ' || l.last_name) ILIKE ?
          OR l.admission_number ILIKE ? OR l.guardian_name ILIKE ? OR l.guardian_phone ILIKE ?)`,
        `%${search}%`
      );
    }
    if (classId) add('l.current_class_id = ?', classId);
    if (grade) add('c.grade_level = ?', grade);
    const baseWhere = `WHERE ${conditions.join(' AND ')}`;
    const baseValues = [...values];

    if (status === 'current') add('l.academic_status = ANY(?)', CURRENT_STATUSES);
    if (status === 'unplaced') {
      add('l.academic_status = ANY(?)', CURRENT_STATUSES);
      conditions.push('l.current_class_id IS NULL');
    }
    if (status === 'left') add('l.academic_status = ANY(?)', LEFT_STATUSES);
    const where = `WHERE ${conditions.join(' AND ')}`;
    const offset = (page - 1) * limit;

    const from = 'FROM learners l LEFT JOIN classes c ON c.class_id = l.current_class_id';
    const [listResult, countResult, totalsResult] = await Promise.all([
      pool.query(
        `SELECT ${LIST_COLUMNS} ${from} ${where}
         ORDER BY l.last_name, l.first_name, l.learner_id
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total ${from} ${where}`, values),
      pool.query(
        `SELECT
           COUNT(*)::int AS all,
           COUNT(*) FILTER (WHERE l.academic_status = ANY($${baseValues.length + 1}))::int AS current,
           COUNT(*) FILTER (WHERE l.academic_status = ANY($${baseValues.length + 1})
                              AND l.current_class_id IS NULL)::int AS unplaced,
           COUNT(*) FILTER (WHERE l.academic_status = ANY($${baseValues.length + 2}))::int AS left
         ${from} ${baseWhere}`,
        [...baseValues, CURRENT_STATUSES, LEFT_STATUSES]
      ),
    ]);

    const total = countResult.rows[0].total;
    return {
      learners: listResult.rows,
      counts: totalsResult.rows[0],
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  /** Full record, or undefined when the learner is not in this school. */
  static async findInSchool(learnerId, schoolId) {
    const { rows } = await pool.query(
      `SELECT l.*, c.class_name, c.grade_level, c.academic_year,
              t.user_id AS teacher_id, t.first_name AS teacher_first_name, t.last_name AS teacher_last_name
       FROM learners l
       LEFT JOIN classes c ON c.class_id = l.current_class_id
       LEFT JOIN class_teacher_assignments cta ON cta.class_id = c.class_id AND cta.is_primary
       LEFT JOIN users t ON t.user_id = cta.teacher_id
       WHERE l.learner_id = $1 AND l.school_id = $2`,
      [learnerId, schoolId]
    );
    return rows[0];
  }

  /** Classes the learner has been placed in, newest first. */
  static async history(learnerId) {
    const { rows } = await pool.query(
      `SELECT h.history_id, h.class_id, c.class_name, c.grade_level, h.academic_year,
              h.status, h.enrolled_date, h.completed_date, h.notes
       FROM learner_class_history h
       JOIN classes c ON c.class_id = h.class_id
       WHERE h.learner_id = $1
       ORDER BY h.enrolled_date DESC, h.created_at DESC`,
      [learnerId]
    );
    return rows;
  }

  /** Average mark per subject across the learner's graded work. */
  static async performanceBySubject(learnerId) {
    const { rows } = await pool.query(
      `SELECT COALESCE(s.subject_name, 'Other') AS subject_name,
              COUNT(*)::int AS assessments,
              ROUND(AVG(g.percentage), 1)::float AS average
       FROM grades g
       JOIN assessments a ON a.assessment_id = g.assessment_id
       LEFT JOIN subjects s ON s.subject_id = a.subject_id
       WHERE g.learner_id = $1 AND g.is_graded = true
       GROUP BY 1
       ORDER BY 1`,
      [learnerId]
    );
    return rows;
  }

  static async update(learnerId, data, client = pool) {
    const cleaned = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, blankToNull(value)]));
    const { setClause, values, nextParam } = buildUpdateSet(cleaned, UPDATABLE_COLUMNS);
    if (!setClause) return null;
    const { rows } = await client.query(
      `UPDATE learners SET ${setClause}, updated_at = CURRENT_TIMESTAMP
       WHERE learner_id = $${nextParam}
       RETURNING *`,
      [...values, learnerId]
    );
    return rows[0];
  }

  static async setStatus(learnerId, status, client = pool) {
    await client.query(
      'UPDATE learners SET academic_status = $1, updated_at = CURRENT_TIMESTAMP WHERE learner_id = $2',
      [status, learnerId]
    );
  }

  /**
   * Moves a learner into `classId` (or out of any class when null) and keeps
   * learner_class_history in step: the old placement is closed, a new one opened.
   */
  static async placeInClass(learnerId, classId, client = pool) {
    const { rows } = await client.query('SELECT current_class_id FROM learners WHERE learner_id = $1 FOR UPDATE', [
      learnerId,
    ]);
    const oldClassId = rows[0]?.current_class_id ?? null;
    if (oldClassId === classId) return;

    await client.query(
      `UPDATE learners
       SET current_class_id = $1, previous_class_id = COALESCE($2, previous_class_id), updated_at = CURRENT_TIMESTAMP
       WHERE learner_id = $3`,
      [classId, oldClassId, learnerId]
    );
    if (oldClassId) {
      await client.query(
        `UPDATE learner_class_history SET completed_date = CURRENT_DATE
         WHERE learner_id = $1 AND class_id = $2 AND completed_date IS NULL`,
        [learnerId, oldClassId]
      );
    }
    if (classId) await Learner.openPlacement(learnerId, classId, client);
  }

  static async openPlacement(learnerId, classId, client = pool) {
    await client.query(
      `INSERT INTO learner_class_history (learner_id, class_id, academic_year, status)
       SELECT $1, class_id, academic_year, 'active' FROM classes WHERE class_id = $2`,
      [learnerId, classId]
    );
  }

  /**
   * Deletes a learner added by mistake. Learners with recorded marks are kept
   * (mark them as having left instead), so their results stay in reports.
   */
  static async deleteIfUnmarked(learnerId) {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS marks FROM grades WHERE learner_id = $1', [learnerId]);
    if (rows[0].marks > 0) return { deleted: false, marks: rows[0].marks };
    await pool.query('DELETE FROM learners WHERE learner_id = $1', [learnerId]);
    return { deleted: true };
  }
}

export default Learner;
