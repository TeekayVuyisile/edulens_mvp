import bcrypt from 'bcryptjs';
import pool from './database.js';
import { runMigrations } from '../db/migrator.js';

const DEV_DEFAULT_ADMIN = { email: 'superadmin@edulens.com', password: 'Admin123!' };

const createAdminUser = async () => {
  let adminEmail = process.env.SUPER_ADMIN_EMAIL;
  let adminPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    if (process.env.NODE_ENV === 'production') {
      console.log('SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not set; skipping super admin creation');
      return;
    }
    adminEmail = DEV_DEFAULT_ADMIN.email;
    adminPassword = DEV_DEFAULT_ADMIN.password;
  }

  const existingAdmin = await pool.query('SELECT 1 FROM users WHERE email = $1', [adminEmail]);
  if (existingAdmin.rows.length > 0) {
    console.log('Super admin already exists');
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, 'Super', 'Admin', 'super_admin', true)
     RETURNING user_id, email, role`,
    [adminEmail, passwordHash]
  );
  console.log('Super admin created:', result.rows[0]);
};

const migrate = async () => {
  try {
    console.log('Starting database migration...');
    const applied = await runMigrations(pool);
    console.log(applied.length ? `Applied ${applied.length} migration(s).` : 'Database is up to date.');

    await createAdminUser();
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

migrate();
