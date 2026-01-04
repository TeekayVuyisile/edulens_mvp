import pool from '../config/database.js';

class ClassModel {
  // Create a new class
  static async create(classData) {
    const {
      school_id,
      class_name,
      grade_level,
      academic_year,
      primary_teacher_id,
      max_capacity
    } = classData;

    const query = `
      INSERT INTO classes (
        school_id, class_name, grade_level, academic_year,
        primary_teacher_id, max_capacity
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [
        school_id,
        class_name,
        grade_level,
        academic_year,
        primary_teacher_id,
        max_capacity || 30
      ]);

      // If primary teacher is assigned, create teacher assignment
      if (primary_teacher_id) {
        await ClassModel.assignTeacher({
          class_id: result.rows[0].class_id,
          teacher_id: primary_teacher_id,
          is_primary: true,
          assigned_by: primary_teacher_id
        });
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error creating class:', error);
      throw error;
    }
  }

  // Get class by ID with details
  static async getById(classId) {
    const query = `
      SELECT 
        c.*,
        s.school_name,
        json_build_object(
          'user_id', u.user_id,
          'first_name', u.first_name,
          'last_name', u.last_name,
          'email', u.email
        ) as primary_teacher,
        (
          SELECT json_agg(
            json_build_object(
              'learner_id', l.learner_id,
              'user_id', lu.user_id,
              'first_name', lu.first_name,
              'last_name', lu.last_name,
              'enrollment_date', l.enrollment_date,
              'academic_status', l.academic_status
            )
          )
          FROM learners l
          JOIN users lu ON l.user_id = lu.user_id
          WHERE l.current_class_id = c.class_id
            AND l.academic_status = 'active'
        ) as learners,
        (
          SELECT json_agg(
            json_build_object(
              'teacher_id', u.user_id,
              'first_name', u.first_name,
              'last_name', u.last_name,
              'email', u.email,
              'is_primary', cta.is_primary
            )
          )
          FROM class_teacher_assignments cta
          JOIN users u ON cta.teacher_id = u.user_id
          WHERE cta.class_id = c.class_id
        ) as teachers
      FROM classes c
      LEFT JOIN schools s ON c.school_id = s.school_id
      LEFT JOIN users u ON c.primary_teacher_id = u.user_id
      WHERE c.class_id = $1
    `;

    try {
      const result = await pool.query(query, [classId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting class by ID:', error);
      throw error;
    }
  }

  // Get classes by school
  static async getBySchool(schoolId, academicYear = null) {
    const conditions = ['c.school_id = $1', 'c.is_active = true'];
    const values = [schoolId];
    let paramCount = 2;

    if (academicYear) {
      conditions.push(`c.academic_year = $${paramCount}`);
      values.push(academicYear);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        c.*,
        s.school_name,
        json_build_object(
          'user_id', u.user_id,
          'first_name', u.first_name,
          'last_name', u.last_name
        ) as primary_teacher,
        COUNT(l.learner_id) as learner_count
      FROM classes c
      LEFT JOIN schools s ON c.school_id = s.school_id
      LEFT JOIN users u ON c.primary_teacher_id = u.user_id
      LEFT JOIN learners l ON c.class_id = l.current_class_id 
        AND l.academic_status = 'active'
      ${whereClause}
      GROUP BY c.class_id, s.school_name, u.user_id
      ORDER BY c.grade_level, c.class_name
    `;

    try {
      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting classes by school:', error);
      throw error;
    }
  }

  // Get classes by teacher
  static async getByTeacher(teacherId, academicYear = null) {
    const conditions = ['cta.teacher_id = $1', 'c.is_active = true'];
    const values = [teacherId];
    let paramCount = 2;

    if (academicYear) {
      conditions.push(`c.academic_year = $${paramCount}`);
      values.push(academicYear);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        c.*,
        s.school_name,
        COUNT(l.learner_id) as learner_count,
        cta.is_primary
      FROM class_teacher_assignments cta
      JOIN classes c ON cta.class_id = c.class_id
      JOIN schools s ON c.school_id = s.school_id
      LEFT JOIN learners l ON c.class_id = l.current_class_id 
        AND l.academic_status = 'active'
      ${whereClause}
      GROUP BY c.class_id, s.school_name, cta.is_primary
      ORDER BY c.grade_level, c.class_name
    `;

    try {
      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting classes by teacher:', error);
      throw error;
    }
  }

  // Update class
  static async update(classId, updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined && key !== 'primary_teacher_id') {
        fields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(classId);
    const query = `
      UPDATE classes 
      SET ${fields.join(', ')}
      WHERE class_id = $${paramCount}
      RETURNING *
    `;

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating class:', error);
      throw error;
    }
  }

  // Assign teacher to class
  static async assignTeacher(assignmentData) {
    const {
      class_id,
      teacher_id,
      is_primary = false,
      assigned_by
    } = assignmentData;

    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Insert assignment
      const assignmentQuery = `
        INSERT INTO class_teacher_assignments (
          class_id, teacher_id, is_primary, assigned_by
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (class_id, teacher_id) 
        DO UPDATE SET is_primary = EXCLUDED.is_primary
        RETURNING *
      `;

      const assignmentResult = await client.query(assignmentQuery, [
        class_id,
        teacher_id,
        is_primary,
        assigned_by
      ]);

      // If this is primary teacher, update class record
      if (is_primary) {
        const updateClassQuery = `
          UPDATE classes 
          SET primary_teacher_id = $1
          WHERE class_id = $2
        `;
        await client.query(updateClassQuery, [teacher_id, class_id]);
      }

      await client.query('COMMIT');
      return assignmentResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error assigning teacher to class:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get class statistics
  static async getStatistics(classId) {
    const queries = {
      totalLearners: `
        SELECT COUNT(*) FROM learners 
        WHERE current_class_id = $1 AND academic_status = 'active'
      `,
      totalAssessments: `
        SELECT COUNT(*) FROM assessments 
        WHERE class_id = $1
      `,
      averageScore: `
        SELECT ROUND(AVG(g.percentage), 2) as average_score
        FROM grades g
        JOIN assessments a ON g.assessment_id = a.assessment_id
        WHERE a.class_id = $1 AND g.percentage IS NOT NULL
      `,
      recentAssessments: `
        SELECT assessment_name, scheduled_date, assessment_type
        FROM assessments
        WHERE class_id = $1
        ORDER BY scheduled_date DESC
        LIMIT 5
      `
    };

    try {
      const results = await Promise.all(
        Object.values(queries).map(query => pool.query(query, [classId]))
      );

      return {
        totalLearners: parseInt(results[0].rows[0].count),
        totalAssessments: parseInt(results[1].rows[0].count),
        averageScore: parseFloat(results[2].rows[0].average_score) || 0,
        recentAssessments: results[3].rows
      };
    } catch (error) {
      console.error('Error getting class statistics:', error);
      throw error;
    }
  }

  // Archive class (end of academic year)
  static async archive(classId) {
    const query = `
      UPDATE classes 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE class_id = $1
      RETURNING class_id, class_name, is_active
    `;

    try {
      const result = await pool.query(query, [classId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error archiving class:', error);
      throw error;
    }
  }
}

export default ClassModel;