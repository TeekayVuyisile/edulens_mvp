import pool from '../config/database.js';
import { buildUpdateSet } from '../db/sql.js';
import { CURRENT_STATUSES } from './Learner.js';

/** Foundation Phase grades a class can be in. */
export const CLASS_GRADES = ['R', '1', '2', '3'];

// Columns a caller may change through update(); everything else is ignored.
const UPDATABLE_COLUMNS = ['class_name', 'grade_level', 'academic_year', 'term_number', 'max_capacity'];

// Current learners in a class, as a correlated subquery on `c`.
const LEARNER_COUNT = `(SELECT COUNT(*)::int FROM learners l
   WHERE l.current_class_id = c.class_id AND l.academic_status IN ('active', 'repeated'))`;

// The class's teachers as a JSON array (class teacher first).
const TEACHERS_JSON = `COALESCE((
   SELECT json_agg(json_build_object(
            'user_id', u.user_id, 'first_name', u.first_name, 'last_name', u.last_name,
            'is_primary', cta.is_primary, 'is_active', u.is_active)
          ORDER BY cta.is_primary DESC, u.first_name, u.last_name)
   FROM class_teacher_assignments cta
   JOIN users u ON u.user_id = cta.teacher_id
   WHERE cta.class_id = c.class_id), '[]'::json)`;

class ClassModel {
  /** Creates a class and, optionally, makes `teacher_id` its class teacher. */
  static async create({ school_id, class_name, grade_level, academic_year, max_capacity, teacher_id }, assignedBy) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO classes (school_id, class_name, grade_level, academic_year, max_capacity)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [school_id, class_name.trim(), grade_level, academic_year, max_capacity || 30]
      );
      if (teacher_id) {
        await ClassModel.setTeacher(rows[0].class_id, teacher_id, { isPrimary: true, assignedBy }, client);
      }
      await client.query('COMMIT');
      return rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /** A school's classes with sizes and teachers. Filters: year, grade, status ('active' | 'inactive' | 'all'). */
  static async listForSchool(schoolId, { year, grade, status = 'active' } = {}) {
    const conditions = ['c.school_id = $1'];
    const values = [schoolId];
    if (year) {
      values.push(year);
      conditions.push(`c.academic_year = $${values.length}`);
    }
    if (grade) {
      values.push(grade);
      conditions.push(`c.grade_level = $${values.length}`);
    }
    if (status === 'active') conditions.push('c.is_active');
    if (status === 'inactive') conditions.push('NOT c.is_active');

    const { rows } = await pool.query(
      `SELECT c.class_id, c.class_name, c.grade_level, c.academic_year, c.max_capacity, c.is_active,
              c.primary_teacher_id, c.created_at,
              ${LEARNER_COUNT} AS learner_count,
              ${TEACHERS_JSON} AS teachers
       FROM classes c
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.academic_year DESC,
                CASE c.grade_level WHEN 'R' THEN 0 ELSE 1 END, c.grade_level, c.class_name`,
      values
    );
    return rows;
  }

  /** Years the school has classes for, newest first. */
  static async years(schoolId) {
    const { rows } = await pool.query(
      'SELECT DISTINCT academic_year FROM classes WHERE school_id = $1 ORDER BY academic_year DESC',
      [schoolId]
    );
    return rows.map((r) => r.academic_year);
  }

  /** One class with size and teachers, or undefined when it is not in this school. */
  static async findInSchool(classId, schoolId) {
    const { rows } = await pool.query(
      `SELECT c.*, ${LEARNER_COUNT} AS learner_count, ${TEACHERS_JSON} AS teachers
       FROM classes c
       WHERE c.class_id = $1 AND c.school_id = $2`,
      [classId, schoolId]
    );
    return rows[0];
  }

  /** Current learners in a class with their average mark. */
  static async learners(classId) {
    const { rows } = await pool.query(
      `SELECT l.learner_id, l.first_name, l.last_name, l.admission_number, l.date_of_birth, l.gender,
              l.academic_status, l.has_special_needs, l.guardian_name, l.guardian_phone,
              (SELECT ROUND(AVG(g.percentage), 1)::float
               FROM grades g JOIN assessments a ON a.assessment_id = g.assessment_id
               WHERE g.learner_id = l.learner_id AND a.class_id = $1 AND g.is_graded) AS average
       FROM learners l
       WHERE l.current_class_id = $1 AND l.academic_status = ANY($2)
       ORDER BY l.last_name, l.first_name`,
      [classId, CURRENT_STATUSES]
    );
    return rows;
  }

  /**
   * Places for `adding` more learners, locking the class row so concurrent
   * placements can't overfill it. Call inside a transaction.
   * @returns {{ capacity: number, enrolled: number, free: number }}
   */
  static async room(classId, client = pool) {
    const { rows } = await client.query('SELECT max_capacity FROM classes WHERE class_id = $1 FOR UPDATE', [classId]);
    const { rows: counted } = await client.query(
      `SELECT COUNT(*)::int AS enrolled FROM learners
       WHERE current_class_id = $1 AND academic_status = ANY($2)`,
      [classId, CURRENT_STATUSES]
    );
    const capacity = rows[0]?.max_capacity ?? 30;
    const { enrolled } = counted[0];
    return { capacity, enrolled, free: Math.max(0, capacity - enrolled) };
  }

  static async update(classId, updateData) {
    const { setClause, values, nextParam } = buildUpdateSet(updateData, UPDATABLE_COLUMNS);
    if (!setClause) return null;
    const { rows } = await pool.query(
      `UPDATE classes SET ${setClause}, updated_at = CURRENT_TIMESTAMP
       WHERE class_id = $${nextParam}
       RETURNING *`,
      [...values, classId]
    );
    return rows[0];
  }

  static async setActive(classId, isActive) {
    await pool.query('UPDATE classes SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE class_id = $2', [
      isActive,
      classId,
    ]);
  }

  /**
   * Deletes a class created by mistake. Classes with learners, assessments or
   * placement history must be deactivated instead, so no records disappear.
   */
  static async deleteIfEmpty(classId) {
    const { rows } = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM learners WHERE current_class_id = $1) AS learners,
         (SELECT COUNT(*)::int FROM assessments WHERE class_id = $1) AS assessments,
         (SELECT COUNT(*)::int FROM learner_class_history WHERE class_id = $1) AS placements`,
      [classId]
    );
    const dependents = rows[0];
    if (dependents.learners + dependents.assessments + dependents.placements > 0) {
      return { deleted: false, dependents };
    }
    await pool.query('DELETE FROM classes WHERE class_id = $1', [classId]);
    return { deleted: true };
  }

  /**
   * Adds a teacher to a class, or changes their role in it. Making someone the
   * class teacher demotes the previous one to a support teacher.
   */
  static async setTeacher(classId, teacherId, { isPrimary = false, assignedBy } = {}, client = pool) {
    if (isPrimary) {
      await client.query('UPDATE class_teacher_assignments SET is_primary = false WHERE class_id = $1', [classId]);
    }
    await client.query(
      `INSERT INTO class_teacher_assignments (class_id, teacher_id, is_primary, assigned_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (class_id, teacher_id) DO UPDATE SET is_primary = EXCLUDED.is_primary`,
      [classId, teacherId, isPrimary, assignedBy ?? null]
    );
    await ClassModel.syncPrimaryTeacher(classId, client);
  }

  /** @returns {boolean} whether the teacher was assigned to the class */
  static async removeTeacher(classId, teacherId) {
    const { rowCount } = await pool.query(
      'DELETE FROM class_teacher_assignments WHERE class_id = $1 AND teacher_id = $2',
      [classId, teacherId]
    );
    await ClassModel.syncPrimaryTeacher(classId);
    return rowCount > 0;
  }

  /** classes.primary_teacher_id mirrors the assignment flagged is_primary. */
  static async syncPrimaryTeacher(classId, client = pool) {
    await client.query(
      `UPDATE classes SET primary_teacher_id = (
         SELECT teacher_id FROM class_teacher_assignments WHERE class_id = $1 AND is_primary LIMIT 1
       ), updated_at = CURRENT_TIMESTAMP
       WHERE class_id = $1`,
      [classId]
    );
  }

  // ---- Teacher area ----

  /** Classes a teacher is assigned to, with their role, size, marking backlog and average. */
  static async forTeacher(teacherId, { year, includeInactive = false } = {}) {
    const values = [teacherId];
    let filters = includeInactive ? '' : 'AND c.is_active';
    if (year) {
      values.push(year);
      filters += ` AND c.academic_year = $${values.length}`;
    }
    const { rows } = await pool.query(
      `SELECT c.class_id, c.class_name, c.grade_level, c.academic_year, c.max_capacity, c.is_active,
              cta.is_primary, ${LEARNER_COUNT} AS learner_count, ${TEACHERS_JSON} AS teachers,
              (SELECT COUNT(*)::int FROM assessments a WHERE a.class_id = c.class_id) AS assessment_count,
              (SELECT ROUND(AVG(g.percentage), 1)::float FROM grades g
               JOIN assessments a ON a.assessment_id = g.assessment_id
               WHERE a.class_id = c.class_id AND g.is_graded) AS average
       FROM class_teacher_assignments cta
       JOIN classes c ON c.class_id = cta.class_id
       WHERE cta.teacher_id = $1 ${filters}
       ORDER BY c.academic_year DESC, CASE c.grade_level WHEN 'R' THEN 0 ELSE 1 END, c.grade_level, c.class_name`,
      values
    );
    return rows;
  }

  /** The class (with the teacher's role in it) if the teacher is assigned to it. */
  static async findForTeacher(classId, teacherId) {
    const { rows } = await pool.query(
      `SELECT c.*, cta.is_primary, ${LEARNER_COUNT} AS learner_count, ${TEACHERS_JSON} AS teachers
       FROM classes c
       JOIN class_teacher_assignments cta ON cta.class_id = c.class_id AND cta.teacher_id = $2
       WHERE c.class_id = $1`,
      [classId, teacherId]
    );
    return rows[0];
  }

  /**
   * Learners × assessments for one class (optionally one term): the columns,
   * and each learner's percentage per assessment plus their average.
   */
  static async marksheet(classId, { term } = {}) {
    const values = [classId];
    let termFilter = '';
    if (term) {
      values.push(term);
      termFilter = 'AND a.term_number = $2';
    }
    const [assessments, learners, marks] = await Promise.all([
      pool.query(
        `SELECT a.assessment_id, a.assessment_name, a.assessment_type, a.term_number, a.total_marks::float AS total_marks,
                a.scheduled_date, s.subject_name
         FROM assessments a
         LEFT JOIN subjects s ON s.subject_id = a.subject_id
         WHERE a.class_id = $1 ${termFilter}
         ORDER BY COALESCE(a.scheduled_date, a.created_at::date), a.created_at`,
        values
      ),
      ClassModel.learners(classId),
      pool.query(
        `SELECT g.learner_id, g.assessment_id, g.percentage::float AS percentage
         FROM grades g JOIN assessments a ON a.assessment_id = g.assessment_id
         WHERE a.class_id = $1 AND g.is_graded ${termFilter}`,
        values
      ),
    ]);

    const byLearner = new Map();
    for (const m of marks.rows) {
      if (!byLearner.has(m.learner_id)) byLearner.set(m.learner_id, {});
      byLearner.get(m.learner_id)[m.assessment_id] = m.percentage;
    }
    const round = (n) => Math.round(n * 10) / 10;
    return {
      assessments: assessments.rows,
      learners: learners.map((l) => {
        const scores = byLearner.get(l.learner_id) ?? {};
        const values = Object.values(scores);
        return {
          learner_id: l.learner_id,
          first_name: l.first_name,
          last_name: l.last_name,
          has_special_needs: l.has_special_needs,
          marks: scores,
          average: values.length ? round(values.reduce((a, b) => a + b, 0) / values.length) : null,
        };
      }),
    };
  }
}

export default ClassModel;
