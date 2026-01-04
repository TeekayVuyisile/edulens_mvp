import pool from '../config/database.js';

class Learner {
  // Get learner by ID with full details
  static async getById(learnerId) {
    const query = `
      SELECT 
        l.*,
        u.first_name,
        u.last_name,
        u.email,
        c.class_name,
        c.grade_level,
        c.academic_year,
        s.school_name,
        json_build_object(
          'user_id', t.user_id,
          'first_name', t.first_name,
          'last_name', t.last_name
        ) as class_teacher
      FROM learners l
      JOIN users u ON l.user_id = u.user_id
      LEFT JOIN classes c ON l.current_class_id = c.class_id
      LEFT JOIN schools s ON l.school_id = s.school_id
      LEFT JOIN users t ON c.primary_teacher_id = t.user_id
      WHERE l.learner_id = $1
    `;

    try {
      const result = await pool.query(query, [learnerId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting learner by ID:', error);
      throw error;
    }
  }
  

  // Get learner performance summary
  static async getPerformanceSummary(learnerId, academicYear = null) {
    const conditions = ['g.learner_id = $1', 'g.is_graded = true'];
    const values = [learnerId];
    let paramCount = 2;

    if (academicYear) {
      conditions.push(`c.academic_year = $${paramCount}`);
      values.push(academicYear);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        s.subject_name,
        COUNT(DISTINCT a.assessment_id) as total_assessments,
        ROUND(AVG(g.percentage), 2) as average_score,
        MIN(g.percentage) as lowest_score,
        MAX(g.percentage) as highest_score,
        COUNT(CASE WHEN g.percentage >= 75 THEN 1 END) as distinctions,
        COUNT(CASE WHEN g.percentage >= 50 AND g.percentage < 75 THEN 1 END) as passes,
        COUNT(CASE WHEN g.percentage < 50 THEN 1 END) as fails
      FROM grades g
      JOIN assessments a ON g.assessment_id = a.assessment_id
      JOIN subjects s ON a.subject_id = s.subject_id
      JOIN classes c ON a.class_id = c.class_id
      ${whereClause}
      GROUP BY s.subject_name
      ORDER BY s.subject_name
    `;

    try {
      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting learner performance summary:', error);
      throw error;
    }
  }

  // Get recent assessments for learner
  static async getRecentAssessments(learnerId, limit = 10) {
    const query = `
      SELECT 
        a.assessment_name,
        a.assessment_type,
        s.subject_name,
        t.topic_name,
        a.term_number,
        g.marks_obtained,
        g.percentage,
        g.grade_letter,
        g.teacher_feedback,
        g.graded_at,
        a.scheduled_date
      FROM grades g
      JOIN assessments a ON g.assessment_id = a.assessment_id
      LEFT JOIN subjects s ON a.subject_id = s.subject_id
      LEFT JOIN topics t ON a.topic_id = t.topic_id
      WHERE g.learner_id = $1 AND g.is_graded = true
      ORDER BY g.graded_at DESC
      LIMIT $2
    `;

    try {
      const result = await pool.query(query, [learnerId, limit]);
      return result.rows;
    } catch (error) {
      console.error('Error getting recent assessments:', error);
      throw error;
    }
  }

  // Update learner profile
  static async update(learnerId, updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(learnerId);
    const query = `
      UPDATE learners 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE learner_id = $${paramCount}
      RETURNING *
    `;

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating learner:', error);
      throw error;
    }
  }
}

export default Learner;