import pool from '../../config/database.js';
import ClassModel from '../../models/Class.js';
import { CURRENT_STATUSES } from '../../models/Learner.js';
import { recentActivity } from '../../services/activityFeed.js';
import { ok } from '../../utils/respond.js';

const GRADE_ORDER = `CASE c.grade_level WHEN 'R' THEN 0 WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3 ELSE 4 END`;

// GET /api/school-admin/dashboard — the school at a glance, and what needs doing.
export const getDashboard = async (req, res) => {
  const schoolId = req.user.schoolId;
  const year = await ClassModel.currentYear(schoolId);

  const [summary, byGrade, classes, pendingTeachers, activity] = await Promise.all([
    pool.query(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE school_id = $1 AND role = 'teacher' AND is_active)::int AS teachers,
         (SELECT COUNT(*) FROM users
            WHERE school_id = $1 AND role = 'teacher' AND is_active AND last_login IS NULL)::int AS pending_teachers,
         (SELECT COUNT(*) FROM learners WHERE school_id = $1 AND academic_status = ANY($3))::int AS learners,
         (SELECT COUNT(*) FROM learners
            WHERE school_id = $1 AND academic_status = ANY($3) AND current_class_id IS NULL)::int AS unplaced_learners,
         (SELECT COUNT(*) FROM classes WHERE school_id = $1 AND is_active AND academic_year = $2)::int AS classes,
         (SELECT ROUND(AVG(g.percentage), 1)::float
            FROM grades g
            JOIN assessments a ON a.assessment_id = g.assessment_id
            JOIN classes c ON c.class_id = a.class_id
            WHERE c.school_id = $1 AND c.academic_year = $2 AND g.is_graded) AS average_mark`,
      [schoolId, year, CURRENT_STATUSES]
    ),
    pool.query(
      `SELECT c.grade_level AS grade, COUNT(l.learner_id)::int AS learners
       FROM learners l
       JOIN classes c ON c.class_id = l.current_class_id
       WHERE l.school_id = $1 AND l.academic_status = ANY($2)
       GROUP BY c.grade_level
       ORDER BY ${GRADE_ORDER}`,
      [schoolId, CURRENT_STATUSES]
    ),
    // This year's classes with size and class teacher, for "classes at a glance".
    pool.query(
      `SELECT c.class_id, c.class_name, c.grade_level, c.max_capacity,
              t.first_name AS teacher_first_name, t.last_name AS teacher_last_name,
              (SELECT COUNT(*)::int FROM learners l
               WHERE l.current_class_id = c.class_id AND l.academic_status = ANY($3)) AS learner_count
       FROM classes c
       LEFT JOIN class_teacher_assignments cta ON cta.class_id = c.class_id AND cta.is_primary
       LEFT JOIN users t ON t.user_id = cta.teacher_id
       WHERE c.school_id = $1 AND c.is_active AND c.academic_year = $2
       ORDER BY ${GRADE_ORDER}, c.class_name`,
      [schoolId, year, CURRENT_STATUSES]
    ),
    pool.query(
      `SELECT user_id, first_name, last_name, email, created_at FROM users
       WHERE school_id = $1 AND role = 'teacher' AND is_active AND last_login IS NULL
       ORDER BY created_at DESC
       LIMIT 5`,
      [schoolId]
    ),
    recentActivity({ schoolId, limit: 8 }),
  ]);

  const classRows = classes.rows;
  ok(res, {
    year,
    summary: summary.rows[0],
    learnersByGrade: byGrade.rows,
    classes: classRows,
    attention: {
      classesWithoutTeacher: classRows.filter((c) => !c.teacher_first_name),
      fullClasses: classRows.filter((c) => c.learner_count >= c.max_capacity),
      pendingTeachers: pendingTeachers.rows,
      unplacedLearners: summary.rows[0].unplaced_learners,
    },
    recentActivity: activity,
  });
};
