import pool from '../config/database.js';

class Assessment {
  // Create a new assessment
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

    console.log('Creating assessment with data:', assessmentData);

    const query = `
      INSERT INTO assessments (
        class_id, teacher_id, curriculum_id, subject_id, topic_id,
        assessment_name, assessment_type, description, total_marks,
        passing_marks, term_number, due_date, scheduled_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      class_id, 
      teacher_id, 
      curriculum_id || null, 
      subject_id || null, 
      topic_id || null,
      assessment_name, 
      assessment_type, 
      description || null, 
      total_marks,
      passing_marks || null, 
      term_number, 
      due_date || null, 
      scheduled_date || null
    ];

    console.log('Executing query with values:', values);

    try {
      const result = await pool.query(query, values);
      console.log('Assessment created successfully:', result.rows[0]);
      return result.rows[0];
    } catch (error) {
      console.error('Database error creating assessment:', error);
      throw error;
    }
  }

  // Get assessments by teacher
  static async getByTeacher(teacherId, filters = {}) {
    let query = `
      SELECT 
        a.*,
        c.class_name,
        c.grade_level,
        s.subject_name,
        t.topic_name,
        cur.curriculum_name,
        COUNT(DISTINCT g.grade_id) as graded,
        COUNT(DISTINCT l.learner_id) as submissions
      FROM assessments a
      LEFT JOIN classes c ON a.class_id = c.class_id
      LEFT JOIN subjects s ON a.subject_id = s.subject_id
      LEFT JOIN topics t ON a.topic_id = t.topic_id
      LEFT JOIN curricula cur ON a.curriculum_id = cur.curriculum_id
      LEFT JOIN grades g ON a.assessment_id = g.assessment_id AND g.is_graded = true
      LEFT JOIN learners l ON a.class_id = l.current_class_id
      WHERE a.teacher_id = $1
    `;

    const values = [teacherId];
    let paramCount = 1;

    // Add filters
    if (filters.term_number) {
      paramCount++;
      query += ` AND a.term_number = $${paramCount}`;
      values.push(filters.term_number);
    }

    if (filters.class_id) {
      paramCount++;
      query += ` AND a.class_id = $${paramCount}`;
      values.push(filters.class_id);
    }

    if (filters.assessment_type) {
      paramCount++;
      query += ` AND a.assessment_type = $${paramCount}`;
      values.push(filters.assessment_type);
    }

    query += `
      GROUP BY 
        a.assessment_id, 
        c.class_id,
        s.subject_id,
        t.topic_id,
        cur.curriculum_id
      ORDER BY a.created_at DESC
    `;

    if (filters.limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      values.push(filters.limit);
    }

    if (filters.page && filters.limit) {
      paramCount++;
      const offset = (filters.page - 1) * filters.limit;
      query += ` OFFSET $${paramCount}`;
      values.push(offset);
    }

    const result = await pool.query(query, values);
    return {
      assessments: result.rows,
      total: result.rows.length
    };
  }

  // Get assessment by ID
  static async getById(assessmentId) {
    const query = `
      SELECT 
        a.*,
        c.class_name,
        c.grade_level,
        s.subject_name,
        t.topic_name,
        cur.curriculum_name,
        u.first_name as teacher_first_name,
        u.last_name as teacher_last_name
      FROM assessments a
      LEFT JOIN classes c ON a.class_id = c.class_id
      LEFT JOIN subjects s ON a.subject_id = s.subject_id
      LEFT JOIN topics t ON a.topic_id = t.topic_id
      LEFT JOIN curricula cur ON a.curriculum_id = cur.curriculum_id
      LEFT JOIN users u ON a.teacher_id = u.user_id
      WHERE a.assessment_id = $1
    `;

    const result = await pool.query(query, [assessmentId]);
    return result.rows[0];
  }

  // Get assessments by class
  static async getByClass(classId, filters = {}) {
    let query = `
      SELECT 
        a.*,
        s.subject_name,
        t.topic_name,
        cur.curriculum_name,
        COUNT(DISTINCT g.grade_id) as graded_count
      FROM assessments a
      LEFT JOIN subjects s ON a.subject_id = s.subject_id
      LEFT JOIN topics t ON a.topic_id = t.topic_id
      LEFT JOIN curricula cur ON a.curriculum_id = cur.curriculum_id
      LEFT JOIN grades g ON a.assessment_id = g.assessment_id AND g.is_graded = true
      WHERE a.class_id = $1
    `;

    const values = [classId];
    let paramCount = 1;

    // Add filters
    if (filters.term_number) {
      paramCount++;
      query += ` AND a.term_number = $${paramCount}`;
      values.push(filters.term_number);
    }

    if (filters.subject_id) {
      paramCount++;
      query += ` AND a.subject_id = $${paramCount}`;
      values.push(filters.subject_id);
    }

    if (filters.assessment_type) {
      paramCount++;
      query += ` AND a.assessment_type = $${paramCount}`;
      values.push(filters.assessment_type);
    }

    query += `
      GROUP BY 
        a.assessment_id, 
        s.subject_id,
        t.topic_id,
        cur.curriculum_id
      ORDER BY a.scheduled_date DESC
    `;

    const result = await pool.query(query, values);
    return result.rows;
  }

  // Update assessment
  static async update(assessmentId, updateData) {
    const fields = Object.keys(updateData);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    
    const query = `
      UPDATE assessments
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE assessment_id = $1
      RETURNING *
    `;

    const values = [assessmentId, ...fields.map(field => updateData[field])];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Delete assessment
  static async delete(assessmentId) {
    const query = `
      DELETE FROM assessments
      WHERE assessment_id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [assessmentId]);
    return result.rows[0];
  }

// Get assessment gradebook
static async getGradebook(assessmentId) {
  console.log('Getting gradebook for assessment:', assessmentId);
  
  // First, get the assessment details to get the class_id
  const assessmentQuery = await pool.query(
    `SELECT a.*, c.class_id, c.class_name 
     FROM assessments a 
     LEFT JOIN classes c ON a.class_id = c.class_id 
     WHERE a.assessment_id = $1`,
    [assessmentId]
  );
  
  if (assessmentQuery.rows.length === 0) {
    throw new Error('Assessment not found');
  }
  
  const assessment = assessmentQuery.rows[0];
  const classId = assessment.class_id;
  
  console.log('Assessment class_id:', classId);
  
  // Get all learners in the class
  const learnersQuery = `
    SELECT 
      l.learner_id,
      u.user_id,
      u.first_name,
      u.last_name,
      u.email,
      u.profile_image_url,
      l.guardian_name,
      l.guardian_email
    FROM learners l
    JOIN users u ON l.user_id = u.user_id
    WHERE l.current_class_id = $1 
      AND l.academic_status = 'active'
    ORDER BY u.last_name, u.first_name
  `;
  
  // Get existing grades for this assessment
  const gradesQuery = `
    SELECT 
      g.*,
      l.learner_id,
      u.first_name,
      u.last_name
    FROM grades g
    JOIN learners l ON g.learner_id = l.learner_id
    JOIN users u ON l.user_id = u.user_id
    WHERE g.assessment_id = $1
    ORDER BY u.last_name, u.first_name
  `;
  
  try {
    const [learnersResult, gradesResult] = await Promise.all([
      pool.query(learnersQuery, [classId]),
      pool.query(gradesQuery, [assessmentId])
    ]);
    
    console.log('Learners found:', learnersResult.rows.length);
    console.log('Existing grades:', gradesResult.rows.length);
    
    // Create a map of learner_id to grade for quick lookup
    const gradeMap = {};
    gradesResult.rows.forEach(grade => {
      gradeMap[grade.learner_id] = grade;
    });
    
    // Merge learners with their grades
    const gradebook = learnersResult.rows.map(learner => {
      const existingGrade = gradeMap[learner.learner_id];
      
      if (existingGrade) {
        return {
          ...existingGrade,
          first_name: learner.first_name,
          last_name: learner.last_name,
          email: learner.email,
          guardian_name: learner.guardian_name,
          guardian_email: learner.guardian_email
        };
      } else {
        return {
          learner_id: learner.learner_id,
          user_id: learner.user_id,
          first_name: learner.first_name,
          last_name: learner.last_name,
          email: learner.email,
          guardian_name: learner.guardian_name,
          guardian_email: learner.guardian_email,
          marks_obtained: null,
          percentage: null,
          grade_letter: null,
          teacher_feedback: null,
          is_graded: false,
          graded_by: null,
          graded_at: null
        };
      }
    });
    
    console.log('Gradebook created with', gradebook.length, 'entries');
    return gradebook;
    
  } catch (error) {
    console.error('Error in getGradebook:', error);
    throw error;
  }
}

  // Bulk grade assessment
  static async bulkGrade(assessmentId, grades, teacherId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // First, get total marks for the assessment
      const assessmentQuery = await client.query(
        'SELECT total_marks FROM assessments WHERE assessment_id = $1',
        [assessmentId]
      );

      if (assessmentQuery.rows.length === 0) {
        throw new Error('Assessment not found');
      }

      const totalMarks = assessmentQuery.rows[0].total_marks;
      const gradedGrades = [];

      for (const gradeData of grades) {
        const { learner_id, marks_obtained, teacher_feedback } = gradeData;
        
        // Calculate percentage
        const percentage = (marks_obtained / totalMarks) * 100;
        
        // Determine grade letter
        let grade_letter = '';
        if (percentage >= 80) grade_letter = 'A';
        else if (percentage >= 70) grade_letter = 'B';
        else if (percentage >= 60) grade_letter = 'C';
        else if (percentage >= 50) grade_letter = 'D';
        else grade_letter = 'F';

        // Check if grade already exists
        const existingQuery = await client.query(
          'SELECT grade_id FROM grades WHERE assessment_id = $1 AND learner_id = $2',
          [assessmentId, learner_id]
        );

        if (existingQuery.rows.length > 0) {
          // Update existing grade
          const updateQuery = `
            UPDATE grades
            SET marks_obtained = $1,
                percentage = $2,
                grade_letter = $3,
                teacher_feedback = $4,
                is_graded = true,
                graded_by = $5,
                graded_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE assessment_id = $6 AND learner_id = $7
            RETURNING *
          `;

          const updateResult = await client.query(updateQuery, [
            marks_obtained,
            percentage,
            grade_letter,
            teacher_feedback || null,
            teacherId,
            assessmentId,
            learner_id
          ]);

          gradedGrades.push(updateResult.rows[0]);
        } else {
          // Insert new grade
          const insertQuery = `
            INSERT INTO grades (
              assessment_id, learner_id, marks_obtained, percentage,
              grade_letter, teacher_feedback, is_graded, graded_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, true, $7)
            RETURNING *
          `;

          const insertResult = await client.query(insertQuery, [
            assessmentId,
            learner_id,
            marks_obtained,
            percentage,
            grade_letter,
            teacher_feedback || null,
            teacherId
          ]);

          gradedGrades.push(insertResult.rows[0]);
        }
      }

      await client.query('COMMIT');
      return gradedGrades;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export default Assessment;