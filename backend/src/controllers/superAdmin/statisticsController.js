import pool from '../../config/database.js';
import { describeActivity } from '../../services/activityDescriptions.js';
import { ok } from '../../utils/respond.js';

// GET /api/super-admin/statistics — everything the platform dashboard needs.
export const getPlatformStatistics = async (req, res) => {
  const [summary, growth, learnersByGrade, activity, schoolsWithoutAdmin] = await Promise.all([
    pool.query(`
      SELECT
        (SELECT COUNT(*) FROM schools)::int AS schools,
        (SELECT COUNT(*) FROM schools WHERE is_active)::int AS active_schools,
        (SELECT COUNT(*) FROM users WHERE role = 'school_admin' AND is_active)::int AS school_admins,
        (SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_active)::int AS teachers,
        (SELECT COUNT(*) FROM learners WHERE academic_status = 'active')::int AS learners,
        (SELECT COUNT(*) FROM classes WHERE is_active)::int AS classes,
        (SELECT COUNT(*) FROM users
           WHERE role IN ('school_admin', 'teacher') AND is_active AND last_login IS NULL)::int AS pending_invites,
        (SELECT COUNT(*) FROM users
           WHERE role IN ('super_admin', 'school_admin', 'teacher')
             AND last_login > NOW() - INTERVAL '7 days')::int AS active_last_7_days
    `),
    // Schools and learners added per month for the last 12 months (zero-filled).
    pool.query(`
      SELECT
        TO_CHAR(m.month, 'YYYY-MM') AS month,
        (SELECT COUNT(*) FROM schools s
           WHERE date_trunc('month', s.created_at) = m.month)::int AS schools,
        (SELECT COUNT(*) FROM learners l
           WHERE date_trunc('month', l.created_at) = m.month)::int AS learners
      FROM generate_series(
        date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
        date_trunc('month', CURRENT_DATE),
        INTERVAL '1 month'
      ) AS m(month)
      ORDER BY m.month
    `),
    pool.query(`
      SELECT c.grade_level AS grade, COUNT(l.learner_id)::int AS learners
      FROM learners l
      JOIN classes c ON c.class_id = l.current_class_id
      WHERE l.academic_status = 'active'
      GROUP BY c.grade_level
      ORDER BY CASE c.grade_level WHEN 'R' THEN 0 WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3 ELSE 4 END
    `),
    pool.query(`
      SELECT al.log_id, al.action_type, al.created_at,
             u.first_name, u.last_name, u.role, s.school_name
      FROM activity_logs al
      LEFT JOIN users u ON u.user_id = al.user_id
      LEFT JOIN schools s ON s.school_id = COALESCE(al.school_id, u.school_id)
      -- Changes recorded by the request logger ("METHOD /api/..."). Rows from the old
      -- logger (router-relative paths) and ad-hoc event names can't be described well.
      WHERE al.action_type SIMILAR TO '(POST|PUT|PATCH|DELETE) /api/%'
        AND al.action_type NOT LIKE '% /api/auth/%'
        AND al.user_id IS NOT NULL
        AND COALESCE((al.action_details ->> 'statusCode')::int, 200) < 400
      ORDER BY al.created_at DESC
      LIMIT 12
    `),
    pool.query(`
      SELECT s.school_id, s.school_name, s.school_code, s.created_at
      FROM schools s
      WHERE s.is_active AND NOT EXISTS (
        SELECT 1 FROM users u WHERE u.school_id = s.school_id AND u.role = 'school_admin' AND u.is_active
      )
      ORDER BY s.created_at DESC
      LIMIT 5
    `),
  ]);

  ok(res, {
    summary: summary.rows[0],
    growth: growth.rows,
    learnersByGrade: learnersByGrade.rows,
    recentActivity: activity.rows.map((row) => ({
      id: row.log_id,
      description: describeActivity(row.action_type),
      actor: row.first_name ? `${row.first_name} ${row.last_name}` : null,
      role: row.role,
      school_name: row.school_name,
      created_at: row.created_at,
    })),
    attention: { schoolsWithoutAdmin: schoolsWithoutAdmin.rows },
  });
};
