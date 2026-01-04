import pool from './database.js';
import bcrypt from 'bcryptjs';

const seedDatabase = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('Starting database seeding...');

    // 1. Create Super Admin if not exists
    const superAdminEmail = 'superadmin@edulens.com';
    const superAdminCheck = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [superAdminEmail]
    );

    if (superAdminCheck.rows.length === 0) {
      const passwordHash = await bcrypt.hash('Admin123!', 10);
      
      await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [superAdminEmail, passwordHash, 'Super', 'Admin', 'super_admin', true]
      );
      console.log('✓ Super Admin created');
    }

    // 2. Create sample curriculum (CAPS)
    const capsCurriculum = await client.query(
      `INSERT INTO curricula (curriculum_name, description)
       VALUES ('CAPS', 'South African Curriculum and Assessment Policy Statement')
       ON CONFLICT (curriculum_name) DO NOTHING
       RETURNING curriculum_id`
    );

    let capsId = capsCurriculum.rows[0]?.curriculum_id;
    
    if (!capsId) {
      const existingCaps = await client.query(
        "SELECT curriculum_id FROM curricula WHERE curriculum_name = 'CAPS'"
      );
      capsId = existingCaps.rows[0]?.curriculum_id;
    }

    if (capsId) {
      // 3. Create sample subjects for CAPS
      const subjects = [
        { name: 'Mathematics', code: 'MATH', grade_level: 'R-3' },
        { name: 'English Home Language', code: 'ENG-HL', grade_level: 'R-3' },
        { name: 'Life Skills', code: 'LIFE', grade_level: 'R-3' },
        { name: 'First Additional Language', code: 'FAL', grade_level: 'R-3' }
      ];

      for (const subject of subjects) {
        const subjectResult = await client.query(
          `INSERT INTO subjects (curriculum_id, subject_name, subject_code, grade_level)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (curriculum_id, subject_name, grade_level) DO NOTHING
           RETURNING subject_id`,
          [capsId, subject.name, subject.code, subject.grade_level]
        );

        if (subjectResult.rows[0]) {
          const subjectId = subjectResult.rows[0].subject_id;
          
          // 4. Create sample topics for English Home Language
          if (subject.name === 'English Home Language') {
            const topics = [
              { name: 'Phonemic Awareness', description: 'Ability to hear and manipulate sounds' },
              { name: 'Reading Comprehension', description: 'Understanding written text' },
              { name: 'Vocabulary Development', description: 'Learning new words' },
              { name: 'Writing Skills', description: 'Handwriting and composition' }
            ];

            for (const topic of topics) {
              await client.query(
                `INSERT INTO topics (subject_id, topic_name, description)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (subject_id, topic_name) DO NOTHING`,
                [subjectId, topic.name, topic.description]
              );
            }
            console.log('✓ Sample topics created for English');
          }
        }
      }
      console.log('✓ Sample subjects created');
    }

    await client.query('COMMIT');
    console.log('✓ Database seeding completed successfully');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Run seed if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      console.log('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export default seedDatabase;