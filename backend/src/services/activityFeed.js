import pool from '../config/database.js';
import { describeActivity } from './activityDescriptions.js';

/**
 * Recent changes as readable sentences for a dashboard feed: platform-wide,
 * or for one school when `schoolId` is given.
 */
export const recentActivity = async ({ schoolId, limit = 12 } = {}) => {
  const values = [limit];
  let schoolFilter = '';
  if (schoolId) {
    values.push(schoolId);
    schoolFilter = 'AND COALESCE(al.school_id, u.school_id) = $2';
  }

  const { rows } = await pool.query(
    `SELECT al.log_id, al.action_type, al.created_at,
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
       ${schoolFilter}
     ORDER BY al.created_at DESC
     LIMIT $1`,
    values
  );

  return rows.map((row) => ({
    id: row.log_id,
    description: describeActivity(row.action_type),
    actor: row.first_name ? `${row.first_name} ${row.last_name}` : null,
    role: row.role,
    school_name: row.school_name,
    created_at: row.created_at,
  }));
};
