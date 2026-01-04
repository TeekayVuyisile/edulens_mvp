import pool from '../config/database.js';

class Assessment {
  // Create assessment
  static async create(assessmentData) {
    const {
      class_id,
      teacher_id,
      curriculum_id,
      subject_id,
      topic_id,
      assessment_name,
      assessment_type,
      description,
      total_marks,
      passing_marks,
      term_number,
      due_date,
      scheduled_date
    } = assessmentData;

    const query = `
      INSERT INTO assessments (
        class_id, teacher_id, curriculum_id, subject_id, topic_id,
        assessment_name, assessment_type, description, total_marks,
        passing_marks, term_number, due_date, scheduled_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [
        class_id,
        teacher_id,
        curriculum_id,
        subject_id,
        topic_id,
        assessment_name,
        assessment_type,
        description,
        total_marks,
        passing_marks,
        term_number,
        due_date,
        scheduled_date
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error creating assessment:', error);
      throw error;
    }
  }

  // Get assessment by ID with details
  static async getById(assessmentId) {
    const query = `
      SELECT 
        a.*,
        c.class_name,
        c.grade_level,
        s.school_name,
        cur.curriculum_name,
        sub.subject_name,
        t.topic_name,
        json_build_object(
          'user_id', u.user_id,
          'first_name', u.first_name,
          'last_name', u.last_name
        ) as teacher,
        (
          SELECT json_agg(
            json_build_object(
              'resource_id', ar.resource_id,
              'resource_name', ar.resource_name,
              'resource_type', ar.resource_type,
              'resource_url', ar.resource_url,
              'uploaded_at', ar.uploaded_at
            )
          )
          FROM assessment_resources ar
          WHERE ar.assessment_id = a.assessment_id
        ) as resources,
        (
          SELECT COUNT(*)
          FROM grades g
          WHERE g.assessment_id = a.assessment_id
            AND g.is_graded = true
        ) as graded_count,
        (
          SELECT COUNT(*)
          FROM learners l
          WHERE l.current_class_id = a.class_id
            AND l.academic_status = 'active'
        ) as total_learners
      FROM assessments a
      LEFT JOIN classes c ON a.class_id = c.class_id
      LEFT JOIN schools s ON c.school_id = s.school_id
      LEFT JOIN curricula cur ON a.curriculum_id = cur.curriculum_id
      LEFT JOIN subjects sub ON a.subject_id = sub.subject_id
      LEFT JOIN topics t ON a.topic_id = t.topic_id
      LEFT JOIN users u ON a.teacher_id = u.user_id
      WHERE a.assessment_id = $1
    `;

    try {
      const result = await pool.query(query, [assessmentId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting assessment by ID:', error);
      throw error;
    }
  }

  // Get assessments by class
  static async getByClass(classId, filters = {}) {
    const conditions = ['a.class_id = $1'];
    const values = [classId];
    let paramCount = 2;

    if (filters.term_number) {
      conditions.push(`a.term_number = $${paramCount}`);
      values.push(filters.term_number);
      paramCount++;
    }

    if (filters.subject_id) {
      conditions.push(`a.subject_id = $${paramCount}`);
      values.push(filters.subject_id);
      paramCount++;
    }

    if (filters.assessment_type) {
      conditions.push(`a.assessment_type = $${paramCount}`);
      values.push(filters.assessment_type);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        a.*,
        sub.subject_name,
        t.topic_name,
        COUNT(g.grade_id) as submissions,
        COUNT(CASE WHEN g.is_graded THEN 1 END) as graded
      FROM assessments a
      LEFT JOIN subjects sub ON a.subject_id = sub.subject_id
      LEFT JOIN topics t ON a.topic_id = t.topic_id
      LEFT JOIN grades g ON a.assessment_id = g.assessment_id
      ${whereClause}
      GROUP BY a.assessment_id, sub.subject_name, t.topic_name
      ORDER BY a.scheduled_date DESC, a.created_at DESC
    `;

    try {
      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting assessments by class:', error);
      throw error;
    }
  }

  // Get assessments by teacher
  static async getByTeacher(teacherId, filters = {}) {
    const conditions = ['a.teacher_id = $1'];
    const values = [teacherId];
    let paramCount = 2;

    if (filters.class_id) {
      conditions.push(`a.class_id = $${paramCount}`);
      values.push(filters.class_id);
      paramCount++;
    }

    if (filters.term_number) {
      conditions.push(`a.term_number = $${paramCount}`);
      values.push(filters.term_number);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        a.*,
        c.class_name,
        c.grade_level,
        sub.subject_name,
        t.topic_name,
        COUNT(g.grade_id) as submissions,
        COUNT(CASE WHEN g.is_graded THEN 1 END) as graded
      FROM assessments a
      LEFT JOIN classes c ON a.class_id = c.class_id
      LEFT JOIN subjects sub ON a.subject_id = sub.subject_id
      LEFT JOIN topics t ON a.topic_id = t.topic_id
      LEFT JOIN grades g ON a.assessment_id = g.assessment_id
      ${whereClause}
      GROUP BY a.assessment_id, c.class_name, c.grade_level, 
               sub.subject_name, t.topic_name
      ORDER BY a.scheduled_date DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const offset = (filters.page - 1) * filters.limit || 0;
    const limit = filters.limit || 20;

    values.push(limit, offset);

    // Count query
    const countQuery = `
      SELECT COUNT(*) 
      FROM assessments a
      ${whereClause}
    `;

    try {
      const [assessmentsResult, countResult] = await Promise.all([
        pool.query(query, values),
        pool.query(countQuery, [teacherId])
      ]);

      return {
        assessments: assessmentsResult.rows,
        total: parseInt(countResult.rows[0].count),
        page: filters.page || 1,
        limit
      };
    } catch (error) {
      console.error('Error getting assessments by teacher:', error);
      throw error;
    }
  }

  // Update assessment
  static async update(assessmentId, updateData) {
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

    values.push(assessmentId);
    const query = `
      UPDATE assessments 
      SET ${fields.join(', ')}
      WHERE assessment_id = $${paramCount}
      RETURNING *
    `;

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating assessment:', error);
      throw error;
    }
  }

  // Add resource to assessment
  static async addResource(resourceData) {
    const {
      assessment_id,
      resource_name,
      resource_type,
      resource_url,
      uploaded_by
    } = resourceData;

    const query = `
      INSERT INTO assessment_resources (
        assessment_id, resource_name, resource_type, 
        resource_url, uploaded_by
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [
        assessment_id,
        resource_name,
        resource_type,
        resource_url,
        uploaded_by
      ]);
      return result.rows[0];
    } catch (error) {
      console.error('Error adding resource to assessment:', error);
      throw error;
    }
  }

  // Get gradebook view for assessment
  static async getGradebook(assessmentId) {
    const query = `
      SELECT 
        l.learner_id,
        u.first_name,
        u.last_name,
        g.marks_obtained,
        g.percentage,
        g.grade_letter,
        g.teacher_feedback,
        g.is_graded,
        g.graded_at
      FROM assessments a
      JOIN classes c ON a.class_id = c.class_id
      JOIN learners l ON c.class_id = l.current_class_id
        AND l.academic_status = 'active'
      JOIN users u ON l.user_id = u.user_id
      LEFT JOIN grades g ON a.assessment_id = g.assessment_id 
        AND l.learner_id = g.learner_id
      WHERE a.assessment_id = $1
      ORDER BY u.last_name, u.first_name
    `;

    try {
      const result = await pool.query(query, [assessmentId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting gradebook:', error);
      throw error;
    }
  }

  // Bulk grade submission
  static async bulkGrade(assessmentId, grades, gradedBy) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const results = [];
      
      for (const grade of grades) {
        const query = `
          INSERT INTO grades (
            assessment_id, learner_id, marks_obtained,
            percentage, grade_letter, teacher_feedback,
            is_graded, graded_by, graded_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, true, $7, CURRENT_TIMESTAMP)
          ON CONFLICT (assessment_id, learner_id) 
          DO UPDATE SET
            marks_obtained = EXCLUDED.marks_obtained,
            percentage = EXCLUDED.percentage,
            grade_letter = EXCLUDED.grade_letter,
            teacher_feedback = EXCLUDED.teacher_feedback,
            is_graded = EXCLUDED.is_graded,
            graded_by = EXCLUDED.graded_by,
            graded_at = EXCLUDED.graded_at,
            updated_at = CURRENT_TIMESTAMP
          RETURNING *
        `;

        const result = await client.query(query, [
          assessmentId,
          grade.learner_id,
          grade.marks_obtained,
          grade.percentage,
          grade.grade_letter,
          grade.teacher_feedback,
          gradedBy
        ]);

        results.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in bulk grading:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

export default Assessment;