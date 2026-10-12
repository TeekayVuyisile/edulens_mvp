import pool from '../../config/database.js';
import ClassModel from '../../models/Class.js';
import { ok } from '../../utils/respond.js';

// CAPS achievement levels used on South African report cards.
const LEVEL = `CASE
  WHEN g.percentage >= 80 THEN 7 WHEN g.percentage >= 70 THEN 6 WHEN g.percentage >= 60 THEN 5
  WHEN g.percentage >= 50 THEN 4 WHEN g.percentage >= 40 THEN 3 WHEN g.percentage >= 30 THEN 2
  ELSE 1 END`;

const GRADE_ORDER = `CASE c.grade_level WHEN 'R' THEN 0 WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3 ELSE 4 END`;

/** Below this average a learner is flagged as needing support (CAPS level 3 and under). */
export const SUPPORT_THRESHOLD = 50;

// GET /api/school-admin/reports/performance?year=&grade=&term=
export const getPerformance = async (req, res) => {
  const schoolId = req.user.schoolId;
  const [years, currentYear] = await Promise.all([ClassModel.years(schoolId), ClassModel.currentYear(schoolId)]);
  const year = Number(req.query.year) || currentYear;

  // Marks for this school's classes in the chosen year, optionally narrowed down.
  const values = [schoolId, year];
  let filters = '';
  if (req.query.grade) {
    values.push(req.query.grade);
    filters += ` AND c.grade_level = $${values.length}`;
  }
  if (req.query.term) {
    values.push(req.query.term);
    filters += ` AND a.term_number = $${values.length}`;
  }
  const marks = (joins = '') => `
    FROM grades g
    JOIN assessments a ON a.assessment_id = g.assessment_id
    JOIN classes c ON c.class_id = a.class_id
    ${joins}
    WHERE c.school_id = $1 AND c.academic_year = $2 AND g.is_graded AND g.percentage IS NOT NULL ${filters}`;

  const [summary, levels, byClass, bySubject, support] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS marks,
              COUNT(DISTINCT g.learner_id)::int AS learners_assessed,
              COUNT(DISTINCT a.assessment_id)::int AS assessments,
              ROUND(AVG(g.percentage), 1)::float AS average
       ${marks()}`,
      values
    ),
    pool.query(`SELECT ${LEVEL} AS level, COUNT(*)::int AS marks ${marks()} GROUP BY 1 ORDER BY 1 DESC`, values),
    pool.query(
      `SELECT c.class_id, c.class_name, c.grade_level,
              t.first_name AS teacher_first_name, t.last_name AS teacher_last_name,
              COUNT(DISTINCT a.assessment_id)::int AS assessments,
              COUNT(DISTINCT g.learner_id)::int AS learners_assessed,
              ROUND(AVG(g.percentage), 1)::float AS average,
              COUNT(*) FILTER (WHERE g.percentage < ${SUPPORT_THRESHOLD})::int AS marks_below_50
       ${marks(`LEFT JOIN class_teacher_assignments cta ON cta.class_id = c.class_id AND cta.is_primary
                LEFT JOIN users t ON t.user_id = cta.teacher_id`)}
       GROUP BY c.class_id, c.class_name, c.grade_level, t.first_name, t.last_name
       ORDER BY ${GRADE_ORDER}, c.class_name`,
      values
    ),
    pool.query(
      `SELECT COALESCE(s.subject_name, 'Other') AS subject_name,
              COUNT(DISTINCT a.assessment_id)::int AS assessments,
              ROUND(AVG(g.percentage), 1)::float AS average
       ${marks('LEFT JOIN subjects s ON s.subject_id = a.subject_id')}
       GROUP BY 1
       ORDER BY 1`,
      values
    ),
    // Learners whose average is below the threshold, lowest first.
    pool.query(
      `SELECT l.learner_id, l.first_name, l.last_name, cl.class_name,
              ROUND(AVG(g.percentage), 1)::float AS average, COUNT(*)::int AS marks
       ${marks(`JOIN learners l ON l.learner_id = g.learner_id
                LEFT JOIN classes cl ON cl.class_id = l.current_class_id`)}
       GROUP BY l.learner_id, l.first_name, l.last_name, cl.class_name
       HAVING AVG(g.percentage) < ${SUPPORT_THRESHOLD}
       ORDER BY AVG(g.percentage), l.last_name
       LIMIT 10`,
      values
    ),
  ]);

  ok(res, {
    year,
    years: years.length > 0 ? years : [year],
    summary: summary.rows[0],
    levels: levels.rows,
    classes: byClass.rows,
    subjects: bySubject.rows,
    needsSupport: support.rows,
  });
};
