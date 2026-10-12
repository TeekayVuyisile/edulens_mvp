import pool from '../config/database.js';
import { buildUpdateSet } from '../db/sql.js';
import { CURRENT_STATUSES } from './Learner.js';

export const ASSESSMENT_TYPES = ['test', 'quiz', 'project', 'worksheet', 'assignment'];
export const TERMS = ['1', '2', '3', '4'];

// Columns a caller may change through update(); the class and owner never change.
const UPDATABLE_COLUMNS = [
  'assessment_name', 'assessment_type', 'description', 'total_marks', 'passing_marks',
  'term_number', 'due_date', 'scheduled_date', 'curriculum_id', 'subject_id', 'topic_id',
];

/** CAPS achievement level (1–7) for a percentage, stored on each mark. */
export const capsLevel = (percentage) => {
  const bands = [80, 70, 60, 50, 40, 30];
  const index = bands.findIndex((min) => percentage >= min);
  return index === -1 ? 1 : 7 - index;
};

// Marking progress for assessment `a`: learners currently in its class, and how many have a mark.
const PROGRESS = `
  (SELECT COUNT(*)::int FROM learners l
   WHERE l.current_class_id = a.class_id AND l.academic_status IN ('active', 'repeated')) AS learner_count,
  (SELECT COUNT(*)::int FROM grades g
   JOIN learners l ON l.learner_id = g.learner_id
   WHERE g.assessment_id = a.assessment_id AND g.is_graded
     AND l.current_class_id = a.class_id AND l.academic_status IN ('active', 'repeated')) AS marked_count,
  (SELECT ROUND(AVG(g.percentage), 1)::float FROM grades g
   WHERE g.assessment_id = a.assessment_id AND g.is_graded) AS average`;

const DETAILS = `
  a.*, c.class_name, c.grade_level, c.academic_year, c.is_active AS class_is_active,
  s.subject_name, t.topic_name, cur.curriculum_name,
  u.first_name AS teacher_first_name, u.last_name AS teacher_last_name,
  ${PROGRESS}`;

const DETAIL_JOINS = `
  JOIN classes c ON c.class_id = a.class_id
  LEFT JOIN subjects s ON s.subject_id = a.subject_id
  LEFT JOIN topics t ON t.topic_id = a.topic_id
  LEFT JOIN curricula cur ON cur.curriculum_id = a.curriculum_id
  LEFT JOIN users u ON u.user_id = a.teacher_id`;

// Assessments in classes the teacher is assigned to.
const TAUGHT_BY = `EXISTS (SELECT 1 FROM class_teacher_assignments cta
                           WHERE cta.class_id = a.class_id AND cta.teacher_id = $1)`;

class Assessment {
  static async create(data) {
    const { rows } = await pool.query(
      `INSERT INTO assessments (class_id, teacher_id, curriculum_id, subject_id, topic_id, assessment_name,
         assessment_type, description, total_marks, passing_marks, term_number, due_date, scheduled_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        data.class_id, data.teacher_id, data.curriculum_id || null, data.subject_id || null, data.topic_id || null,
        data.assessment_name, data.assessment_type, data.description || null, data.total_marks,
        data.passing_marks || null, data.term_number, data.due_date || null, data.scheduled_date || null,
      ]
    );
    return rows[0];
  }

  /** One assessment with class, subject and marking progress — only if the teacher teaches its class. */
  static async findForTeacher(assessmentId, teacherId) {
    const { rows } = await pool.query(
      `SELECT ${DETAILS} FROM assessments a ${DETAIL_JOINS}
       WHERE a.assessment_id = $2 AND ${TAUGHT_BY}`,
      [teacherId, assessmentId]
    );
    return rows[0];
  }

  /**
   * Assessments in the teacher's classes, newest first.
   * Filters: classId, term, year, status ('to_mark' | 'marked'), search.
   */
  static async listForTeacher(teacherId, { classId, term, year, status, search } = {}) {
    const values = [teacherId];
    const conditions = [TAUGHT_BY];
    const add = (sql, value) => {
      values.push(value);
      conditions.push(sql.replaceAll('?', `$${values.length}`));
    };
    if (classId) add('a.class_id = ?', classId);
    if (term) add('a.term_number = ?', term);
    if (year) add('c.academic_year = ?', year);
    if (search) add('(a.assessment_name ILIKE ? OR s.subject_name ILIKE ?)', `%${search}%`);

    const { rows } = await pool.query(
      `SELECT * FROM (
         SELECT ${DETAILS} FROM assessments a ${DETAIL_JOINS}
         WHERE ${conditions.join(' AND ')}
       ) x
       ${status === 'to_mark' ? 'WHERE x.marked_count < x.learner_count' : ''}
       ${status === 'marked' ? 'WHERE x.marked_count >= x.learner_count' : ''}
       ORDER BY COALESCE(x.scheduled_date, x.created_at::date) DESC, x.created_at DESC`,
      values
    );
    return rows;
  }

  static async update(assessmentId, data) {
    const { setClause, values, nextParam } = buildUpdateSet(data, UPDATABLE_COLUMNS);
    if (!setClause) return null;
    const { rows } = await pool.query(
      `UPDATE assessments SET ${setClause}, updated_at = CURRENT_TIMESTAMP
       WHERE assessment_id = $${nextParam}
       RETURNING *`,
      [...values, assessmentId]
    );
    return rows[0];
  }

  static async delete(assessmentId) {
    await pool.query('DELETE FROM assessments WHERE assessment_id = $1', [assessmentId]);
  }

  /** Recalculates every mark's percentage and level, e.g. after total_marks changes. */
  static async recalculate(assessmentId, totalMarks) {
    const { rows } = await pool.query(
      'SELECT grade_id, marks_obtained FROM grades WHERE assessment_id = $1 AND marks_obtained IS NOT NULL',
      [assessmentId]
    );
    for (const row of rows) {
      const percentage = (Number(row.marks_obtained) / totalMarks) * 100;
      await pool.query('UPDATE grades SET percentage = $1, grade_letter = $2 WHERE grade_id = $3', [
        percentage,
        String(capsLevel(percentage)),
        row.grade_id,
      ]);
    }
  }

  /**
   * The mark sheet: every learner now in the class (marked or not), plus
   * learners who were marked before moving out of it.
   */
  static async marks(assessmentId, classId) {
    const { rows } = await pool.query(
      `SELECT l.learner_id, l.first_name, l.last_name, l.admission_number, l.has_special_needs,
              COALESCE(l.current_class_id = $2 AND l.academic_status = ANY($3), false) AS in_class,
              g.marks_obtained::float AS marks_obtained, g.percentage::float AS percentage,
              g.teacher_feedback, g.graded_at
       FROM learners l
       LEFT JOIN grades g ON g.learner_id = l.learner_id AND g.assessment_id = $1 AND g.is_graded
       WHERE (l.current_class_id = $2 AND l.academic_status = ANY($3)) OR g.grade_id IS NOT NULL
       ORDER BY l.last_name, l.first_name`,
      [assessmentId, classId, CURRENT_STATUSES]
    );
    return rows;
  }

  /**
   * Saves marks in one transaction. An entry with marks_obtained null clears
   * that learner's mark. Returns how many were saved and cleared.
   */
  static async saveMarks(assessment, entries, teacherId, client) {
    let saved = 0;
    let cleared = 0;
    for (const entry of entries) {
      if (entry.marks_obtained === null || entry.marks_obtained === undefined || entry.marks_obtained === '') {
        const { rowCount } = await client.query('DELETE FROM grades WHERE assessment_id = $1 AND learner_id = $2', [
          assessment.assessment_id,
          entry.learner_id,
        ]);
        cleared += rowCount;
        continue;
      }
      const marks = Number(entry.marks_obtained);
      const percentage = (marks / Number(assessment.total_marks)) * 100;
      await client.query(
        `INSERT INTO grades (assessment_id, learner_id, marks_obtained, percentage, grade_letter,
           teacher_feedback, is_graded, graded_by, graded_at)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7, CURRENT_TIMESTAMP)
         ON CONFLICT (assessment_id, learner_id) DO UPDATE SET
           marks_obtained = EXCLUDED.marks_obtained, percentage = EXCLUDED.percentage,
           grade_letter = EXCLUDED.grade_letter, teacher_feedback = EXCLUDED.teacher_feedback,
           is_graded = true, graded_by = EXCLUDED.graded_by, graded_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP`,
        [
          assessment.assessment_id,
          entry.learner_id,
          marks,
          percentage,
          String(capsLevel(percentage)),
          entry.teacher_feedback?.trim() || null,
          teacherId,
        ]
      );
      saved += 1;
    }
    return { saved, cleared };
  }

  // ---- Resources (files stored in the database, or links) ----

  static async resources(assessmentId) {
    const { rows } = await pool.query(
      `SELECT r.resource_id, r.resource_name, r.resource_type, r.resource_url, r.mime_type, r.file_size,
              r.uploaded_at, u.first_name AS uploaded_by_first_name, u.last_name AS uploaded_by_last_name
       FROM assessment_resources r
       LEFT JOIN users u ON u.user_id = r.uploaded_by
       WHERE r.assessment_id = $1
       ORDER BY r.uploaded_at DESC`,
      [assessmentId]
    );
    return rows;
  }

  static async addResource({ assessmentId, name, type, url, mimeType, data, size, uploadedBy }) {
    const { rows } = await pool.query(
      `INSERT INTO assessment_resources (assessment_id, resource_name, resource_type, resource_url,
         mime_type, file_data, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING resource_id, resource_name, resource_type, resource_url, mime_type, file_size, uploaded_at`,
      [assessmentId, name, type, url ?? null, mimeType ?? null, data ?? null, size ?? null, uploadedBy]
    );
    return rows[0];
  }

  /** A resource's file (with bytes) if it belongs to the assessment. */
  static async resourceFile(assessmentId, resourceId) {
    const { rows } = await pool.query(
      `SELECT resource_name, mime_type, file_data, resource_url FROM assessment_resources
       WHERE assessment_id = $1 AND resource_id = $2`,
      [assessmentId, resourceId]
    );
    return rows[0];
  }

  static async deleteResource(assessmentId, resourceId) {
    const { rowCount } = await pool.query(
      'DELETE FROM assessment_resources WHERE assessment_id = $1 AND resource_id = $2',
      [assessmentId, resourceId]
    );
    return rowCount > 0;
  }
}

export default Assessment;
