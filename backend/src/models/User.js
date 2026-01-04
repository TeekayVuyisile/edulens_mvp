import pool from '../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

class User {
  // Create a new user
  static async create(userData) {
    const {
      email,
      password,
      first_name,
      last_name,
      role,
      school_id,
      phone,
      profile_image_url
    } = userData;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const query = `
      INSERT INTO users (
        email, password_hash, first_name, last_name, role, 
        school_id, phone, profile_image_url
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING 
        user_id, email, first_name, last_name, role, 
        school_id, phone, profile_image_url, is_active, created_at
    `;

    const values = [
      email,
      passwordHash,
      first_name,
      last_name,
      role,
      school_id,
      phone,
      profile_image_url
    ];

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email) {
    const query = `
      SELECT 
        user_id, email, password_hash, first_name, last_name, 
        role, school_id, phone, profile_image_url, is_active,
        last_login, created_at
      FROM users 
      WHERE email = $1
    `;

    try {
      const result = await pool.query(query, [email]);
      return result.rows[0];
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  // Find user by ID
  static async findById(userId) {
    const query = `
      SELECT 
        user_id, email, first_name, last_name, role, 
        school_id, phone, profile_image_url, is_active,
        last_login, created_at
      FROM users 
      WHERE user_id = $1
    `;

    try {
      const result = await pool.query(query, [userId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  // Update user
  static async update(userId, updateData) {
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

    values.push(userId);
    const query = `
      UPDATE users 
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $${paramCount}
      RETURNING 
        user_id, email, first_name, last_name, role, 
        school_id, phone, profile_image_url, is_active
    `;

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  // Compare password
  static async comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  // Generate JWT token
  static generateToken(user) {
    return jwt.sign(
      {
        userId: user.user_id,
        email: user.email,
        role: user.role,
        schoolId: user.school_id
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );
  }

  // Update last login
  static async updateLastLogin(userId) {
    const query = `
      UPDATE users 
      SET last_login = CURRENT_TIMESTAMP 
      WHERE user_id = $1
    `;

    try {
      await pool.query(query, [userId]);
    } catch (error) {
      console.error('Error updating last login:', error);
      throw error;
    }
  }

  // Set password reset token
  static async setPasswordResetToken(email, token) {
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // Token expires in 1 hour

    const query = `
      UPDATE users 
      SET 
        password_reset_token = $1,
        password_reset_expires = $2
      WHERE email = $3
    `;

    try {
      await pool.query(query, [token, expires, email]);
    } catch (error) {
      console.error('Error setting password reset token:', error);
      throw error;
    }
  }

  // Reset password
  static async resetPassword(token, newPassword) {
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    const query = `
      UPDATE users 
      SET 
        password_hash = $1,
        password_reset_token = NULL,
        password_reset_expires = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE password_reset_token = $2 
        AND password_reset_expires > CURRENT_TIMESTAMP
      RETURNING user_id, email
    `;

    try {
      const result = await pool.query(query, [passwordHash, token]);
      return result.rows[0];
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  }

// Get users by school and role with pagination
static async getBySchoolAndRole(schoolId, role, page = 1, limit = 20, search = '') {
  const offset = (page - 1) * limit;
  
  const searchCondition = search ? 
    `AND (u.first_name ILIKE $4 OR u.last_name ILIKE $4 OR u.email ILIKE $4 OR u.phone ILIKE $4)` : '';
  const searchValue = search ? `%${search}%` : null;
  
  const params = [schoolId, role, limit, offset];
  if (search) params.push(searchValue);
  
  const query = `
    SELECT 
      u.user_id,
      u.email,
      u.first_name,
      u.last_name,
      u.phone,
      u.role,
      u.is_active,
      u.last_login,
      u.created_at,
      u.updated_at,
      COUNT(DISTINCT cta.class_id) as assigned_classes_count
    FROM users u
    LEFT JOIN class_teacher_assignments cta ON u.user_id = cta.teacher_id
    WHERE u.school_id = $1 
      AND u.role = $2
      ${searchCondition}
    GROUP BY u.user_id
    ORDER BY u.last_name, u.first_name
    LIMIT $3 OFFSET $4
  `;

  const countQuery = `
    SELECT COUNT(*) 
    FROM users u
    WHERE u.school_id = $1 
      AND u.role = $2
      ${searchCondition}
  `;

  const pool = await import('../config/database.js').then(mod => mod.default);
  
  const [usersResult, countResult] = await Promise.all([
    pool.query(query, params),
    pool.query(countQuery, [schoolId, role, ...(search ? [searchValue] : [])])
  ]);

  return {
    users: usersResult.rows,
    total: parseInt(countResult.rows[0].count),
    page,
    limit,
    totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
  };
}

// Create user with password
static async create(userData) {
  const { email, password, first_name, last_name, role, school_id, phone } = userData;
  
  // Hash password
  const bcrypt = await import('bcryptjs');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  
  const pool = await import('../config/database.js').then(mod => mod.default);
  
  const query = `
    INSERT INTO users (
      email, password_hash, first_name, last_name, 
      role, school_id, phone, is_active
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, true)
    RETURNING *
  `;
  
  const result = await pool.query(query, [
    email,
    passwordHash,
    first_name,
    last_name,
    role,
    school_id,
    phone || null
  ]);
  
  return result.rows[0];
}

  // Deactivate user
  static async deactivate(userId) {
    const query = `
      UPDATE users 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING user_id, email, is_active
    `;

    try {
      const result = await pool.query(query, [userId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error deactivating user:', error);
      throw error;
    }
  }
}

export default User;