import pool from '../config/database.js';
import { buildUpdateSet } from '../db/sql.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Columns a caller may change through update(); everything else is ignored.
const PROFILE_COLUMNS = ['first_name', 'last_name', 'phone', 'profile_image_url'];

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
      profile_image_url,
      is_active = true
    } = userData;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const query = `
      INSERT INTO users (
        email, password_hash, first_name, last_name, role, 
        school_id, phone, profile_image_url, is_active
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
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
      phone || null,
      profile_image_url || null,
      is_active
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
        u.user_id, u.email, u.password_hash, u.first_name, u.last_name,
        u.role, u.school_id, u.phone, u.profile_image_url, u.is_active,
        u.last_login, u.created_at, s.school_name
      FROM users u
      LEFT JOIN schools s ON s.school_id = u.school_id
      WHERE LOWER(u.email) = LOWER($1)
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
        u.user_id, u.email, u.first_name, u.last_name, u.role,
        u.school_id, u.phone, u.profile_image_url, u.is_active,
        u.last_login, u.created_at, s.school_name
      FROM users u
      LEFT JOIN schools s ON s.school_id = u.school_id
      WHERE u.user_id = $1
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
    const { setClause, values, nextParam: paramCount } = buildUpdateSet(updateData, PROFILE_COLUMNS);

    if (!setClause) {
      throw new Error('No fields to update');
    }

    values.push(userId);
    const query = `
      UPDATE users 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
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
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
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

  /**
   * Creates a staff account that is activated through an invitation link.
   * The stored password is random and never shown to anyone.
   */
  static async createInvited({ email, first_name, last_name, phone, role, school_id }, client = pool) {
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role, school_id, is_active)
       VALUES (LOWER($1), $2, $3, $4, $5, $6, $7, true)
       RETURNING user_id, email, first_name, last_name, phone, role, school_id, is_active, last_login, created_at`,
      [email.trim(), passwordHash, first_name, last_name, phone || null, role, school_id ?? null]
    );
    return rows[0];
  }

  /**
   * Staff directory for the super admin. Learner rows (legacy) and super admins
   * are not listed. status: 'active' | 'inactive' | 'pending' (never signed in).
   */
  static async listStaff({ search, role, status, schoolId, page = 1, limit = 20 } = {}) {
    const conditions = ["u.role IN ('school_admin', 'teacher')"];
    const values = [];
    const add = (sql, value) => {
      values.push(value);
      conditions.push(sql.replaceAll('?', `$${values.length}`));
    };

    if (search) add('(u.first_name ILIKE ? OR u.last_name ILIKE ? OR u.email ILIKE ?)', `%${search}%`);
    if (role) add('u.role = ?', role);
    if (schoolId) add('u.school_id = ?', schoolId);
    const baseWhere = `WHERE ${conditions.join(' AND ')}`;
    const baseValues = [...values];

    if (status === 'active') conditions.push('u.is_active AND u.last_login IS NOT NULL');
    if (status === 'inactive') conditions.push('NOT u.is_active');
    if (status === 'pending') conditions.push('u.is_active AND u.last_login IS NULL');
    const where = `WHERE ${conditions.join(' AND ')}`;
    const offset = (page - 1) * limit;

    const [listResult, countResult, totalsResult] = await Promise.all([
      pool.query(
        `SELECT u.user_id, u.email, u.first_name, u.last_name, u.phone, u.role, u.school_id,
                u.is_active, u.last_login, u.created_at, s.school_name, s.school_code
         FROM users u
         LEFT JOIN schools s ON s.school_id = u.school_id
         ${where}
         ORDER BY u.created_at DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset]
      ),
      pool.query(`SELECT COUNT(*)::int AS total FROM users u ${where}`, values),
      pool.query(
        `SELECT
           COUNT(*)::int AS all,
           COUNT(*) FILTER (WHERE u.is_active AND u.last_login IS NOT NULL)::int AS active,
           COUNT(*) FILTER (WHERE u.is_active AND u.last_login IS NULL)::int AS pending,
           COUNT(*) FILTER (WHERE NOT u.is_active)::int AS inactive
         FROM users u ${baseWhere}`,
        baseValues
      ),
    ]);

    const total = countResult.rows[0].total;
    return {
      users: listResult.rows,
      counts: totalsResult.rows[0],
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  /** One staff member with their school, for the admin detail view. */
  static async findStaffById(userId) {
    const { rows } = await pool.query(
      `SELECT u.user_id, u.email, u.first_name, u.last_name, u.phone, u.role, u.school_id,
              u.is_active, u.last_login, u.created_at, u.updated_at,
              s.school_name, s.school_code, s.is_active AS school_is_active
       FROM users u
       LEFT JOIN schools s ON s.school_id = u.school_id
       WHERE u.user_id = $1`,
      [userId]
    );
    return rows[0];
  }

  // Only a SHA-256 hash of the reset token is stored, so a database leak
  // doesn't expose usable reset links.
  static hashResetToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Set password reset token (valid for 1 hour)
  static async setPasswordResetToken(userId, token) {
    const query = `
      UPDATE users
      SET
        password_reset_token = $1,
        password_reset_expires = CURRENT_TIMESTAMP + INTERVAL '1 hour'
      WHERE user_id = $2
    `;

    try {
      await pool.query(query, [User.hashResetToken(token), userId]);
    } catch (error) {
      console.error('Error setting password reset token:', error);
      throw error;
    }
  }

  // Reset password; signs the user out of existing sessions via password_changed_at
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
        password_changed_at = date_trunc('second', CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
      WHERE password_reset_token = $2
        AND password_reset_expires > CURRENT_TIMESTAMP
        AND is_active = true
      RETURNING user_id, email
    `;

    try {
      const result = await pool.query(query, [passwordHash, User.hashResetToken(token)]);
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