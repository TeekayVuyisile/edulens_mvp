import pool from '../config/database.js';

class School {
  // Create a new school
  static async create(schoolData) {
    const {
      school_name,
      contact_email,
      contact_phone,
      address,
      city,
      province,
      country
    } = schoolData;

    // Generate unique school code
    const schoolCode = `SCH${Date.now().toString().slice(-6)}`;

    const query = `
      INSERT INTO schools (
        school_name, school_code, contact_email, contact_phone,
        address, city, province, country
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *
    `;

    const values = [
      school_name,
      schoolCode,
      contact_email,
      contact_phone,
      address,
      city,
      province,
      country || 'South Africa'
    ];

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating school:', error);
      throw error;
    }
  }

  // Get all schools with pagination
  static async getAll(page = 1, limit = 20, filters = {}) {
    const offset = (page - 1) * limit;
    const conditions = ['is_active = true'];
    const values = [];
    let paramCount = 1;

    if (filters.search) {
      conditions.push(`(school_name ILIKE $${paramCount} OR school_code ILIKE $${paramCount})`);
      values.push(`%${filters.search}%`);
      paramCount++;
    }

    if (filters.city) {
      conditions.push(`city ILIKE $${paramCount}`);
      values.push(`%${filters.city}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        school_id, school_name, school_code, contact_email,
        contact_phone, address, city, province, country,
        is_active, created_at
      FROM schools 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) FROM schools ${whereClause}
    `;

    try {
      const [schoolsResult, countResult] = await Promise.all([
        pool.query(query, [...values, limit, offset]),
        pool.query(countQuery, values)
      ]);

      return {
        schools: schoolsResult.rows,
        total: parseInt(countResult.rows[0].count),
        page,
        limit,
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      };
    } catch (error) {
      console.error('Error getting schools:', error);
      throw error;
    }
  }

  // Get school by ID
  static async getById(schoolId) {
    const query = `
      SELECT 
        school_id, school_name, school_code, contact_email,
        contact_phone, address, city, province, country,
        is_active, created_at, updated_at
      FROM schools 
      WHERE school_id = $1
    `;

    try {
      const result = await pool.query(query, [schoolId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting school by ID:', error);
      throw error;
    }
  }

  // Update school
  static async update(schoolId, updateData) {
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

    values.push(schoolId);
    const query = `
      UPDATE schools 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE school_id = $${paramCount}
      RETURNING *
    `;

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating school:', error);
      throw error;
    }
  }

  // Deactivate school
  static async deactivate(schoolId) {
    const query = `
      UPDATE schools 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE school_id = $1
      RETURNING school_id, school_name, is_active
    `;

    try {
      const result = await pool.query(query, [schoolId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error deactivating school:', error);
      throw error;
    }
  }

  // Activate school
  static async activate(schoolId) {
    const query = `
      UPDATE schools 
      SET is_active = true, updated_at = CURRENT_TIMESTAMP
      WHERE school_id = $1
      RETURNING school_id, school_name, is_active
    `;

    try {
      const result = await pool.query(query, [schoolId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error activating school:', error);
      throw error;
    }
  }

  // Get school statistics
  static async getStatistics(schoolId) {
    const queries = {
      teachers: `SELECT COUNT(*) FROM users WHERE school_id = $1 AND role = 'teacher' AND is_active = true`,
      learners: `SELECT COUNT(*) FROM learners WHERE school_id = $1 AND academic_status = 'active'`,
      classes: `SELECT COUNT(*) FROM classes WHERE school_id = $1 AND is_active = true`,
      assessments: `
        SELECT COUNT(*) 
        FROM assessments a
        JOIN classes c ON a.class_id = c.class_id
        WHERE c.school_id = $1 AND c.academic_year = EXTRACT(YEAR FROM CURRENT_DATE)
      `,
      averageScore: `
        SELECT ROUND(AVG(g.percentage), 2) as average_score
        FROM grades g
        JOIN assessments a ON g.assessment_id = a.assessment_id
        JOIN classes c ON a.class_id = c.class_id
        WHERE c.school_id = $1 
          AND c.academic_year = EXTRACT(YEAR FROM CURRENT_DATE)
          AND g.percentage IS NOT NULL
      `
    };

    try {
      const results = await Promise.all(
        Object.values(queries).map(query => pool.query(query, [schoolId]))
      );

      return {
        totalTeachers: parseInt(results[0].rows[0].count),
        totalLearners: parseInt(results[1].rows[0].count),
        totalClasses: parseInt(results[2].rows[0].count),
        totalAssessments: parseInt(results[3].rows[0].count),
        averageScore: parseFloat(results[4].rows[0].average_score) || 0
      };
    } catch (error) {
      console.error('Error getting school statistics:', error);
      throw error;
    }
  }
}

export default School;