import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './database.js';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrate = async () => {
  try {
    console.log('Starting database migration...');

    // 1. Read SQL schema file
    const sqlPath = path.join(__dirname, '../../../database/edulens_lms_database.sql');
    const sqlSchema = fs.readFileSync(sqlPath, 'utf8');

    // 2. Execute schema
    // Note: This script executes the entire SQL file. 
    // In a production environment, you would use a migration tool like 'knex' or 'db-migrate'.
    console.log('Executing schema from edulens_lms_database.sql...');
    await pool.query(sqlSchema);
    console.log('Schema executed successfully.');

    // 3. Create Super Admin user
    await createAdminUser();

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

const createAdminUser = async () => {
  try {
    const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@edulens.com';
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Admin123!';

    // Check if super admin already exists
    const checkQuery = 'SELECT * FROM users WHERE email = $1';
    const existingAdmin = await pool.query(checkQuery, [adminEmail]);
    
    if (existingAdmin.rows.length === 0) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      
      const insertQuery = `
        INSERT INTO users (
          email, password_hash, first_name, last_name, role, is_active
        ) 
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING user_id, email, first_name, last_name, role
      `;
      
      const result = await pool.query(insertQuery, [
        adminEmail,
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
    throw error;
  }
};

migrate();
