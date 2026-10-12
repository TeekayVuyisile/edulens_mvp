import { pathToFileURL } from 'url';
import bcrypt from 'bcryptjs';
import pool from './database.js';
import { withTransaction } from '../db/transaction.js';
import Assessment from '../models/Assessment.js';
import ClassModel from '../models/Class.js';
import Learner from '../models/Learner.js';

// Demo data for trying Edulens (and for portfolio reviewers): one school with a
// login for every role, classes, learners, marks and a parent.
//
//   npm run seed:demo           creates it (does nothing if it already exists)
//   npm run seed:demo -- --reset  deletes the demo school and creates it again
//
// Refuses to run when NODE_ENV=production unless DEMO_SEED_ALLOW=true.

export const DEMO_PASSWORD = 'Demo123!';
export const DEMO_SCHOOL_CODE = 'DEMO01';
export const DEMO_ACCOUNTS = [
  { email: 'demo.admin@example.com', first_name: 'Lindiwe', last_name: 'Mokoena', role: 'school_admin' },
  { email: 'demo.teacher@example.com', first_name: 'Thandi', last_name: 'Nkosi', role: 'teacher' },
  { email: 'demo.teacher2@example.com', first_name: 'Sipho', last_name: 'Ndlovu', role: 'teacher' },
  { email: 'demo.parent@example.com', first_name: 'Zanele', last_name: 'Dlamini', role: 'parent' },
];

const SUBJECTS = {
  Mathematics: ['Counting and number', 'Addition and subtraction', 'Shapes and patterns', 'Measurement'],
  'English Home Language': ['Phonics', 'Reading and comprehension', 'Writing', 'Listening and speaking'],
  'Life Skills': ['Beginning knowledge', 'Personal and social wellbeing', 'Creative arts'],
};

const CLASSES = [
  { name: 'Grade RA', grade: 'R', age: 5, teacher: 'demo.teacher@example.com' },
  { name: 'Grade 1A', grade: '1', age: 6, teacher: 'demo.teacher@example.com' },
  { name: 'Grade 2A', grade: '2', age: 7, teacher: 'demo.teacher2@example.com' },
  { name: 'Grade 3A', grade: '3', age: 8, teacher: 'demo.teacher2@example.com' },
];

const FIRST_NAMES = ['Naledi', 'Thabo', 'Ayanda', 'Kagiso', 'Lerato', 'Sibusiso', 'Mpho', 'Zinhle',
  'Bongani', 'Palesa', 'Tshepo', 'Anele', 'Karabo', 'Nomvula', 'Liam', 'Ayesha', 'Pieter', 'Refilwe', 'Siyabonga',
  'Khanyisile', 'Tumelo', 'Busisiwe'];
const LAST_NAMES = ['Dlamini', 'Khumalo', 'Mokoena', 'van Wyk', 'Naidoo', 'Mahlangu', 'Botha', 'Zulu', 'Molefe', 'Pillay', 'Sithole', 'Petersen'];
const COMMENTS = {
  high: ['Excellent work — keep it up!', 'Works neatly and carefully.', 'Shows a strong understanding.'],
  mid: ['Good effort. Practise a little more at home.', 'Getting there — well done for trying.', ''],
  low: ['Needs extra practice with this. Let’s work on it together.', 'Please practise this at home with your child.'],
};

// A small seeded random generator, so every run creates the same data.
let seed = 42;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const pick = (list) => list[Math.floor(random() * list.length)];

const birthday = (age) => {
  const year = new Date().getFullYear() - age - 1;
  const month = 1 + Math.floor(random() * 12);
  const day = 1 + Math.floor(random() * 28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const ensureCurriculum = async (client) => {
  await client.query(
    `INSERT INTO curricula (curriculum_name, description)
     VALUES ('CAPS', 'South African Curriculum and Assessment Policy Statement')
     ON CONFLICT (curriculum_name) DO NOTHING`
  );
  const { rows: [caps] } = await client.query("SELECT curriculum_id FROM curricula WHERE curriculum_name = 'CAPS'");
  const subjects = {};
  for (const [name, topics] of Object.entries(SUBJECTS)) {
    await client.query(
      `INSERT INTO subjects (curriculum_id, subject_name, grade_level) VALUES ($1, $2, 'R-3')
       ON CONFLICT (curriculum_id, subject_name, grade_level) DO NOTHING`,
      [caps.curriculum_id, name]
    );
    const { rows: [subject] } = await client.query(
      "SELECT subject_id FROM subjects WHERE curriculum_id = $1 AND subject_name = $2 AND grade_level = 'R-3'",
      [caps.curriculum_id, name]
    );
    for (const topic of topics) {
      await client.query(
        `INSERT INTO topics (subject_id, topic_name) VALUES ($1, $2) ON CONFLICT (subject_id, topic_name) DO NOTHING`,
        [subject.subject_id, topic]
      );
    }
    const { rows: topicRows } = await client.query('SELECT topic_id FROM topics WHERE subject_id = $1 ORDER BY topic_name', [
      subject.subject_id,
    ]);
    subjects[name] = { subjectId: subject.subject_id, topicIds: topicRows.map((t) => t.topic_id) };
  }
  return { curriculumId: caps.curriculum_id, subjects };
};

export const seedDemo = async ({ reset = false } = {}) => {
  if (process.env.NODE_ENV === 'production' && process.env.DEMO_SEED_ALLOW !== 'true') {
    throw new Error('Refusing to add demo data in production (set DEMO_SEED_ALLOW=true to override).');
  }

  const existing = await pool.query('SELECT school_id FROM schools WHERE school_code = $1', [DEMO_SCHOOL_CODE]);
  if (existing.rows[0] && !reset) return { created: false };
  if (existing.rows[0]) {
    // The school first (its classes, learners, assessments and marks go with it), then the
    // demo accounts by email (parents have no school), detaching their activity log rows.
    const emails = DEMO_ACCOUNTS.map((a) => a.email);
    await withTransaction(async (client) => {
      const schoolId = existing.rows[0].school_id;
      // Explicit order: assessments (and their marks) reference staff accounts.
      await client.query('DELETE FROM assessments WHERE class_id IN (SELECT class_id FROM classes WHERE school_id = $1)', [schoolId]);
      await client.query('DELETE FROM classes WHERE school_id = $1', [schoolId]);
      await client.query('DELETE FROM schools WHERE school_id = $1', [schoolId]);
      await client.query(
        'UPDATE activity_logs SET user_id = NULL WHERE user_id IN (SELECT user_id FROM users WHERE email = ANY($1))',
        [emails]
      );
      await client.query('DELETE FROM users WHERE email = ANY($1)', [emails]);
    });
  }

  const year = new Date().getFullYear();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await withTransaction(async (client) => {
    const { curriculumId, subjects } = await ensureCurriculum(client);

    const { rows: [school] } = await client.query(
      `INSERT INTO schools (school_name, school_code, contact_email, contact_phone, address, city, province)
       VALUES ('Sunflower Primary (Demo)', $1, 'office@sunflower.example.com', '011 555 0100',
               '12 Jacaranda Street', 'Johannesburg', 'Gauteng')
       RETURNING school_id`,
      [DEMO_SCHOOL_CODE]
    );
    await client.query(
      `INSERT INTO school_curriculum_assignments (school_id, curriculum_id, grade_level, academic_year)
       VALUES ($1, $2, 'R-3', $3) ON CONFLICT DO NOTHING`,
      [school.school_id, curriculumId, year]
    );

    const users = {};
    for (const account of DEMO_ACCOUNTS) {
      const { rows: [user] } = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, school_id, is_active, last_login)
         VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
         RETURNING user_id`,
        [account.email, passwordHash, account.first_name, account.last_name, account.role,
          account.role === 'parent' ? null : school.school_id]
      );
      users[account.email] = user.user_id;
    }

    const learnersByClass = {};
    let nameIndex = 0;
    for (const spec of CLASSES) {
      // Everything goes through this transaction's client (the models' own helpers use the pool).
      const { rows: [klass] } = await client.query(
        `INSERT INTO classes (school_id, class_name, grade_level, academic_year, max_capacity)
         VALUES ($1, $2, $3, $4, 28) RETURNING *`,
        [school.school_id, spec.name, spec.grade, year]
      );
      await ClassModel.setTeacher(klass.class_id, users[spec.teacher], { isPrimary: true }, client);
      learnersByClass[spec.name] = { klass, teacherId: users[spec.teacher], learners: [] };

      for (let i = 0; i < 6; i += 1) {
        // The demo parent's children: Amahle (Grade 1A) and her brother Lwazi (Grade 3A).
        const family = i === 0 ? { 'Grade 1A': 'Amahle', 'Grade 3A': 'Lwazi' }[spec.name] : undefined;
        const first = family ?? FIRST_NAMES[nameIndex % FIRST_NAMES.length];
        nameIndex += 1;
        const last = family ? 'Dlamini' : pick(LAST_NAMES);
        const learner = await Learner.create(
          {
            school_id: school.school_id,
            current_class_id: klass.class_id,
            first_name: first,
            last_name: last,
            date_of_birth: birthday(spec.age),
            gender: i % 2 ? 'Male' : 'Female',
            admission_number: `SP-${year}-${String(nameIndex).padStart(3, '0')}`,
            guardian_name: family ? 'Zanele Dlamini' : `${pick(['Nomsa', 'Johan', 'Fatima', 'Peter', 'Grace'])} ${last}`,
            guardian_phone: `08${2 + (i % 3)} 555 ${String(1000 + nameIndex).slice(-4)}`,
            guardian_email: family ? 'demo.parent@example.com' : null,
            has_special_needs: i === 4,
            special_needs_notes: i === 4 ? 'Benefits from extra time and reading support.' : null,
          },
          client
        );
        learnersByClass[spec.name].learners.push(learner);
      }
    }

    // One learner still waiting for a class (shows on the admin dashboard).
    await Learner.create(
      { school_id: school.school_id, first_name: 'Kabelo', last_name: 'Sithole', date_of_birth: birthday(6), gender: 'Male' },
      client
    );

    // Assessments with marks: each learner has a fairly steady level, so averages tell a story.
    const assessmentPlan = [
      ['Mathematics', 'Counting check', 'test', '1', 20],
      ['English Home Language', 'Phonics quiz', 'quiz', '1', 10],
      ['Life Skills', 'My community project', 'project', '2', 15],
      ['Mathematics', 'Adding and taking away', 'test', '3', 25],
      ['English Home Language', 'Reading for meaning', 'assignment', '3', 20],
    ];
    for (const { klass, teacherId, learners } of Object.values(learnersByClass)) {
      const ability = learners.map(() => 0.35 + random() * 0.6);
      for (const [index, [subjectName, name, type, term, total]] of assessmentPlan.entries()) {
        const subject = subjects[subjectName];
        const { rows: [assessment] } = await client.query(
          `INSERT INTO assessments (class_id, teacher_id, curriculum_id, subject_id, topic_id, assessment_name,
             assessment_type, total_marks, term_number, scheduled_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
          [
            klass.class_id, teacherId, curriculumId, subject.subjectId, subject.topicIds[index % subject.topicIds.length],
            name, type, total, term, `${year}-${String(Number(term) * 3 - 1).padStart(2, '0')}-1${index}`,
          ]
        );
        // The last assessment is still being marked in one class.
        const marked = index === assessmentPlan.length - 1 && klass.grade_level === '1' ? learners.slice(0, 3) : learners;
        const entries = marked.map((learner, i) => {
          const score = Math.max(0, Math.min(1, ability[i] + (random() - 0.5) * 0.2));
          const band = score >= 0.7 ? 'high' : score >= 0.5 ? 'mid' : 'low';
          return { learner_id: learner.learner_id, marks_obtained: Math.round(score * total), teacher_feedback: pick(COMMENTS[band]) || null };
        });
        await Assessment.saveMarks(assessment, entries, teacherId, client);
      }
    }

    // The demo parent follows two children in different grades.
    for (const learner of [learnersByClass['Grade 1A'].learners[0], learnersByClass['Grade 3A'].learners[0]]) {
      await client.query(
        "INSERT INTO guardian_links (guardian_id, learner_id, relationship) VALUES ($1, $2, 'Mother')",
        [users['demo.parent@example.com'], learner.learner_id]
      );
    }
  });

  return { created: true };
};

const printAccounts = () => {
  console.log('\nDemo school: Sunflower Primary (Demo). Every demo account uses the password', DEMO_PASSWORD);
  for (const a of DEMO_ACCOUNTS) console.log(`  ${a.role.padEnd(13)} ${a.email}`);
  console.log('  super_admin   superadmin@edulens.com (created by npm run migrate; Admin123! in development)\n');
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDemo({ reset: process.argv.includes('--reset') })
    .then(({ created }) => {
      console.log(created ? '✓ Demo data created.' : 'Demo data already exists (use --reset to recreate it).');
      printAccounts();
      return pool.end();
    })
    .catch(async (error) => {
      console.error('Demo seed failed:', error.message);
      await pool.end();
      process.exit(1);
    });
}
