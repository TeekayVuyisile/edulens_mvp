import pool from '../config/database.js';
import { buildUpdateSet } from '../db/sql.js';

export const GRADE_LEVELS = ['R', '1', '2', '3', 'R-3'];

// Sort grades R, 1, 2, 3, then "R-3" (all grades) last.
const GRADE_ORDER = `CASE grade_level WHEN 'R' THEN 0 WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3 ELSE 4 END`;

// Curricula, subjects and topics share archive/restore/update/delete logic.
const TABLES = {
  curriculum: {
    table: 'curricula',
    id: 'curriculum_id',
    columns: ['curriculum_name', 'description'],
  },
  subject: {
    table: 'subjects',
    id: 'subject_id',
    columns: ['subject_name', 'subject_code', 'grade_level', 'description'],
  },
  topic: {
    table: 'topics',
    id: 'topic_id',
    columns: ['topic_name', 'topic_code', 'description', 'learning_objectives'],
  },
};

class Curriculum {
  /** Active curricula (flat), used by the shared /api/curriculum endpoints. */
  static async getAll(filters = {}) {
    const values = [];
    let where = 'WHERE is_active = true';
    if (filters.search) {
      values.push(`%${filters.search}%`);
      where += ' AND curriculum_name ILIKE $1';
    }
    const { rows } = await pool.query(
      `SELECT curriculum_id, curriculum_name, description, is_active, created_at
       FROM curricula ${where}
       ORDER BY curriculum_name`,
      values
    );
    return rows;
  }

  /** One curriculum with its active subjects and topics, or null. */
  static async getById(curriculumId) {
    const [tree] = await Curriculum.tree({ curriculumId });
    return tree ?? null;
  }

  /**
   * Curricula with nested subjects (ordered by grade) and topics.
   * includeArchived also returns archived items, flagged with is_active = false.
   */
  static async tree({ includeArchived = false, curriculumId } = {}) {
    const values = [includeArchived];
    let filter = '';
    if (curriculumId) {
      values.push(curriculumId);
      filter = 'AND c.curriculum_id = $2';
    }

    const { rows } = await pool.query(
      `SELECT
         c.curriculum_id, c.curriculum_name, c.description, c.is_active, c.created_at,
         (SELECT COUNT(*)::int FROM school_curriculum_assignments sca
            WHERE sca.curriculum_id = c.curriculum_id AND sca.is_active) AS school_assignment_count,
         COALESCE((
           SELECT json_agg(subject ORDER BY subject.grade_order, subject.subject_name)
           FROM (
             SELECT
               s.subject_id, s.subject_name, s.subject_code, s.grade_level, s.description, s.is_active,
               ${GRADE_ORDER.replace(/grade_level/g, 's.grade_level')} AS grade_order,
               COALESCE((
                 SELECT json_agg(json_build_object(
                   'topic_id', t.topic_id,
                   'topic_name', t.topic_name,
                   'topic_code', t.topic_code,
                   'description', t.description,
                   'learning_objectives', t.learning_objectives,
                   'is_active', t.is_active
                 ) ORDER BY t.topic_name)
                 FROM topics t
                 WHERE t.subject_id = s.subject_id AND ($1 OR t.is_active)
               ), '[]'::json) AS topics
             FROM subjects s
             WHERE s.curriculum_id = c.curriculum_id AND ($1 OR s.is_active)
           ) subject
         ), '[]'::json) AS subjects
       FROM curricula c
       WHERE ($1 OR c.is_active) ${filter}
       ORDER BY c.is_active DESC, c.curriculum_name`,
      values
    );
    return rows;
  }

  static async create({ curriculum_name, description }) {
    const { rows } = await pool.query(
      'INSERT INTO curricula (curriculum_name, description) VALUES ($1, $2) RETURNING *',
      [curriculum_name, description || null]
    );
    return rows[0];
  }

  static async createSubject(curriculumId, { subject_name, subject_code, grade_level, description }) {
    const { rows } = await pool.query(
      `INSERT INTO subjects (curriculum_id, subject_name, subject_code, grade_level, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [curriculumId, subject_name, subject_code || null, grade_level, description || null]
    );
    return rows[0];
  }

  static async createTopic(subjectId, { topic_name, topic_code, description, learning_objectives }) {
    const { rows } = await pool.query(
      `INSERT INTO topics (subject_id, topic_name, topic_code, description, learning_objectives)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [subjectId, topic_name, topic_code || null, description || null, learning_objectives || null]
    );
    return rows[0];
  }

  /** Updates allowed columns of a curriculum, subject or topic; returns the row or undefined. */
  static async updateItem(kind, id, data) {
    const { table, id: idColumn, columns } = TABLES[kind];
    const { setClause, values, nextParam } = buildUpdateSet(data, columns);
    if (!setClause) {
      const { rows } = await pool.query(`SELECT * FROM ${table} WHERE ${idColumn} = $1`, [id]);
      return rows[0];
    }
    const { rows } = await pool.query(
      `UPDATE ${table} SET ${setClause} WHERE ${idColumn} = $${nextParam} RETURNING *`,
      [...values, id]
    );
    return rows[0];
  }

  /** Archives (false) or restores (true) a curriculum, subject or topic. */
  static async setActive(kind, id, isActive) {
    const { table, id: idColumn } = TABLES[kind];
    const { rows } = await pool.query(
      `UPDATE ${table} SET is_active = $1 WHERE ${idColumn} = $2 RETURNING *`,
      [isActive, id]
    );
    return rows[0];
  }

  /**
   * Permanently deletes an item and everything below it. Rows that reference it
   * without cascading (assessments, worksheets, progress) make Postgres refuse
   * with a foreign-key error, which the API reports as "in use".
   * Curricula assigned to schools are refused explicitly, because those
   * assignments would otherwise cascade away silently.
   * @returns {{ deleted: boolean, reason?: 'assigned' }} deleted: false when it doesn't exist
   */
  static async deleteItem(kind, id) {
    const { table, id: idColumn } = TABLES[kind];

    if (kind === 'curriculum') {
      const { rows } = await pool.query(
        'SELECT COUNT(*)::int AS n FROM school_curriculum_assignments WHERE curriculum_id = $1',
        [id]
      );
      if (rows[0].n > 0) return { deleted: false, reason: 'assigned' };
    }

    const result = await pool.query(`DELETE FROM ${table} WHERE ${idColumn} = $1`, [id]);
    return { deleted: result.rowCount > 0 };
  }

  static async exists(kind, id, { activeOnly = false } = {}) {
    const { table, id: idColumn } = TABLES[kind];
    const { rows } = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM ${table} WHERE ${idColumn} = $1 ${activeOnly ? 'AND is_active' : ''}) AS ok`,
      [id]
    );
    return rows[0].ok;
  }

  // ---- School assignments ---------------------------------------------------

  static async assignmentsForSchool(schoolId) {
    const { rows } = await pool.query(
      `SELECT sca.assignment_id, sca.school_id, sca.curriculum_id, sca.grade_level, sca.academic_year,
              sca.assigned_at, c.curriculum_name,
              TRIM(CONCAT(u.first_name, ' ', u.last_name)) AS assigned_by_name
       FROM school_curriculum_assignments sca
       JOIN curricula c ON c.curriculum_id = sca.curriculum_id
       LEFT JOIN users u ON u.user_id = sca.assigned_by
       WHERE sca.school_id = $1 AND sca.is_active
       ORDER BY sca.academic_year DESC, ${GRADE_ORDER.replace(/grade_level/g, 'sca.grade_level')}, c.curriculum_name`,
      [schoolId]
    );
    return rows;
  }

  /** Assigns (or re-activates a previously removed assignment). */
  static async assignToSchool({ school_id, curriculum_id, grade_level, academic_year, assigned_by }) {
    const { rows } = await pool.query(
      `INSERT INTO school_curriculum_assignments (school_id, curriculum_id, grade_level, academic_year, assigned_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (school_id, curriculum_id, grade_level, academic_year)
       DO UPDATE SET is_active = true, assigned_by = EXCLUDED.assigned_by, assigned_at = CURRENT_TIMESTAMP
       RETURNING *, (xmax = 0) AS created`,
      [school_id, curriculum_id, grade_level, academic_year, assigned_by]
    );
    return rows[0];
  }

  static async unassignFromSchool(schoolId, assignmentId) {
    const result = await pool.query(
      `UPDATE school_curriculum_assignments SET is_active = false
       WHERE assignment_id = $1 AND school_id = $2 AND is_active`,
      [assignmentId, schoolId]
    );
    return result.rowCount > 0;
  }
}

export default Curriculum;
