import pool from './database.js';

const createAdminUser = async () => {
  try {
    // Check if super admin already exists
    const checkQuery = 'SELECT * FROM users WHERE email = $1';
    const existingAdmin = await pool.query(checkQuery, ['superadmin@edulens.com']);
    
    if (existingAdmin.rows.length === 0) {
      // Create super admin user
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.hash('Admin123!', 10);
      
      const insertQuery = `
        INSERT INTO users (
          email, password_hash, first_name, last_name, role, is_active
        ) 
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING user_id, email, first_name, last_name, role
      `;
      
      const result = await pool.query(insertQuery, [
        'superadmin@edulens.com',
        passwordHash,
        'Super',
        'Admin',
        'super_admin',
        true
      ]);
      
      console.log('Super admin created successfully:', result.rows[0]);
    } else {
      console.log('Super admin already exists');
    }
  } catch (error) {
    console.error('Error creating super admin:', error);
  } finally {
    await pool.end();
  }
};

createAdminUser();