import pool from '../config/database.js';

// Parents and guardians: `users` with role 'parent' (no school of their own),
// linked to learners through guardian_links.

class Guardian {
  /** Guardians linked to a learner, with whether they've signed in yet. */
  static async forLearner(learnerId) {
    const { rows } = await pool.query(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, u.phone, u.is_active, u.last_login,
              gl.relationship, gl.created_at AS linked_at
       FROM guardian_links gl
       JOIN users u ON u.user_id = gl.guardian_id
       WHERE gl.learner_id = $1
       ORDER BY gl.created_at`,
      [learnerId]
    );
    return rows;
  }

  static async findByEmail(email) {
    const { rows } = await pool.query(
      `SELECT user_id, email, first_name, last_name, role, is_active, last_login
       FROM users WHERE LOWER(email) = LOWER($1)`,
      [email]
    );
    return rows[0];
  }

  /** @returns {boolean} false when the link already existed */
  static async link(guardianId, learnerId, { relationship, invitedBy } = {}) {
    const { rowCount } = await pool.query(
      `INSERT INTO guardian_links (guardian_id, learner_id, relationship, invited_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (guardian_id, learner_id) DO NOTHING`,
      [guardianId, learnerId, relationship ?? null, invitedBy ?? null]
    );
    return rowCount > 0;
  }

  /**
   * Removes a link. A parent left with no children can no longer sign in
   * (their account is deactivated, and reactivated if they're linked again).
   * @returns {boolean} whether the link existed
   */
  static async unlink(guardianId, learnerId) {
    const { rowCount } = await pool.query('DELETE FROM guardian_links WHERE guardian_id = $1 AND learner_id = $2', [
      guardianId,
      learnerId,
    ]);
    await pool.query(
      `UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND role = 'parent'
         AND NOT EXISTS (SELECT 1 FROM guardian_links WHERE guardian_id = $1)`,
      [guardianId]
    );
    return rowCount > 0;
  }

  static async isLinked(guardianId, learnerId) {
    const { rows } = await pool.query('SELECT 1 FROM guardian_links WHERE guardian_id = $1 AND learner_id = $2', [
      guardianId,
      learnerId,
    ]);
    return rows.length > 0;
  }

  /** The parent's children with their school, class, class teacher and overall average. */
  static async children(guardianId) {
    const { rows } = await pool.query(
      `SELECT l.learner_id, l.first_name, l.last_name, l.academic_status, gl.relationship,
              s.school_name, s.contact_email AS school_email, s.contact_phone AS school_phone,
              c.class_id, c.class_name, c.grade_level, c.academic_year,
              t.first_name AS teacher_first_name, t.last_name AS teacher_last_name,
              (SELECT ROUND(AVG(g.percentage), 1)::float FROM grades g WHERE g.learner_id = l.learner_id AND g.is_graded) AS average,
              (SELECT MAX(g.graded_at) FROM grades g WHERE g.learner_id = l.learner_id AND g.is_graded) AS last_marked_at
       FROM guardian_links gl
       JOIN learners l ON l.learner_id = gl.learner_id
       JOIN schools s ON s.school_id = l.school_id AND s.is_active
       LEFT JOIN classes c ON c.class_id = l.current_class_id
       LEFT JOIN class_teacher_assignments cta ON cta.class_id = c.class_id AND cta.is_primary
       LEFT JOIN users t ON t.user_id = cta.teacher_id
       WHERE gl.guardian_id = $1
       ORDER BY l.first_name`,
      [guardianId]
    );
    return rows;
  }
}

export default Guardian;
