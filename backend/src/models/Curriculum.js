import pool from '../config/database.js';

class Curriculum {
  // Get all curricula
  static async getAll(filters = {}) {
    const conditions = ['is_active = true'];
    const values = [];
    let paramCount = 1;

    if (filters.search) {
      conditions.push(`curriculum_name ILIKE $${paramCount}`);
      values.push(`%${filters.search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        curriculum_id, curriculum_name, description, 
        is_active, created_at
      FROM curricula 
      ${whereClause}
      ORDER BY curriculum_name
    `;

    try {
      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting curricula:', error);
      throw error;
    }
  }

  // Get curriculum by ID with subjects and topics
  static async getById(curriculumId) {
    const curriculumQuery = `
      SELECT * FROM curricula WHERE curriculum_id = $1
    `;

    const subjectsQuery = `
      SELECT s.*, 
        json_agg(
          json_build_object(
            'topic_id', t.topic_id,
            'topic_name', t.topic_name,
            'topic_code', t.topic_code,
            'description', t.description,
            'learning_objectives', t.learning_objectives
          ) ORDER BY t.topic_name
        ) as topics
      FROM subjects s
      LEFT JOIN topics t ON s.subject_id = t.subject_id AND t.is_active = true
      WHERE s.curriculum_id = $1 AND s.is_active = true
      GROUP BY s.subject_id
      ORDER BY s.subject_name
    `;

    try {
      const [curriculumResult, subjectsResult] = await Promise.all([
        pool.query(curriculumQuery, [curriculumId]),
        pool.query(subjectsQuery, [curriculumId])
      ]);

      if (curriculumResult.rows.length === 0) {
        return null;
      }

      return {
        ...curriculumResult.rows[0],
        subjects: subjectsResult.rows
      };
    } catch (error) {
      console.error('Error getting curriculum by ID:', error);
      throw error;
    }
  }

  // Create new curriculum
  static async create(curriculumData) {
    const { curriculum_name, description } = curriculumData;

    const query = `
      INSERT INTO curricula (curriculum_name, description)
      VALUES ($1, $2)
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [curriculum_name, description]);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating curriculum:', error);
      throw error;
    }
  }

  // Update curriculum
  static async update(curriculumId, updateData) {
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

    values.push(curriculumId);
    const query = `
      UPDATE curricula 
      SET ${fields.join(', ')}
      WHERE curriculum_id = $${paramCount}
      RETURNING *
    `;

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating curriculum:', error);
      throw error;
    }
  }

  // Create subject
  static async createSubject(subjectData) {
    const {
      curriculum_id,
      subject_name,
      subject_code,
      description,
      grade_level
    } = subjectData;

    const query = `
      INSERT INTO subjects (
        curriculum_id, subject_name, subject_code, 
        description, grade_level
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [
        curriculum_id,
        subject_name,
        subject_code,
        description,
        grade_level
      ]);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating subject:', error);
      throw error;
    }
  }

  // Create topic
  static async createTopic(topicData) {
    const {
      subject_id,
      topic_name,
      topic_code,
      description,
      learning_objectives
    } = topicData;

    const query = `
      INSERT INTO topics (
        subject_id, topic_name, topic_code, 
        description, learning_objectives
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [
        subject_id,
        topic_name,
        topic_code,
        description,
        learning_objectives
      ]);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating topic:', error);
      throw error;
    }
  }

  // Assign curriculum to school
  static async assignToSchool(assignmentData) {
    const {
      school_id,
      curriculum_id,
      grade_level,
      academic_year,
      assigned_by
    } = assignmentData;

    const query = `
      INSERT INTO school_curriculum_assignments (
        school_id, curriculum_id, grade_level, 
        academic_year, assigned_by
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (school_id, curriculum_id, grade_level, academic_year) 
      DO UPDATE SET is_active = true
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [
        school_id,
        curriculum_id,
        grade_level,
        academic_year,
        assigned_by
      ]);
      return result.rows[0];
    } catch (error) {
      console.error('Error assigning curriculum to school:', error);
      throw error;
    }
  }
}

export default Curriculum;