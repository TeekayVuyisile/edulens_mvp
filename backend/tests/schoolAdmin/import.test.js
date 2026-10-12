import { beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import xlsx from 'xlsx';
import app from '../../src/app.js';
import pool from '../../src/config/database.js';
import { parseDate } from '../../src/services/learnerImport.js';
import { resetDb } from '../helpers/db.js';
import { authHeader, createClass, createLearner, createUser } from '../helpers/factories.js';

let admin;
let headers;

beforeEach(async () => {
  await resetDb();
  admin = await createUser({ role: 'school_admin' });
  headers = authHeader(admin);
});

const birthYear = new Date().getFullYear() - 7;

const upload = (content, { name = 'learners.csv', dryRun = false } = {}) =>
  request(app)
    .post('/api/school-admin/learners/import')
    .set(headers)
    .field('dry_run', String(dryRun))
    .attach('file', Buffer.from(content), name);

const csv = (...lines) => lines.join('\n');

describe('parseDate', () => {
  it.each([
    ['2019-03-01', '2019-03-01'],
    ['2019/3/1', '2019-03-01'],
    ['01/03/2019', '2019-03-01'], // South African day-first
    ['1-3-2019', '2019-03-01'],
    ['31/02/2019', null],
    ['03/01/19', null],
    ['yesterday', null],
  ])('%s → %s', (text, expected) => {
    expect(parseDate(text)).toBe(expected);
  });
});

describe('checking a file (dry run)', () => {
  it('reports every row with its problems and writes nothing', async () => {
    const klass = await createClass({ school_id: admin.school_id, class_name: 'Grade 1A' });
    await createLearner({ school_id: admin.school_id, first_name: 'Existing', last_name: 'Learner', date_of_birth: `${birthYear}-05-05` });

    const res = await upload(
      csv(
        'First Name,Surname,DOB,Gender,Class,Parent Phone',
        `Amahle,Dlamini,01/03/${birthYear},F,grade 1a,821234567`,
        `Existing,Learner,${birthYear}-05-05,,,`,
        `,Nobody,${birthYear}-01-01,,,`,
        `Sipho,Nkosi,not a date,X,Grade 9Z,`,
        `Amahle,Dlamini,${birthYear}-03-01,,,`
      ),
      { dryRun: true }
    );

    expect(res.status).toBe(200);
    expect(res.body.data.summary).toEqual({ total: 5, ready: 1, withErrors: 4 });
    const [ok, existing, noName, bad, repeat] = res.body.data.rows;
    expect(ok).toMatchObject({
      line: 2,
      errors: [],
      class_name: 'Grade 1A',
      data: { date_of_birth: `${birthYear}-03-01`, gender: 'Female', guardian_phone: '0821234567', current_class_id: klass.class_id },
    });
    expect(existing.errors[0].message).toMatch(/already on the register/);
    expect(noName.errors.map((e) => e.field)).toEqual(['first_name']);
    expect(bad.errors.map((e) => e.field)).toEqual(['date_of_birth', 'gender', 'class_name']);
    expect(repeat.errors[0].message).toBe('Same learner as row 2');

    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM learners');
    expect(rows[0].n).toBe(1);
  });

  it('fills a class only up to its capacity', async () => {
    await createClass({ school_id: admin.school_id, class_name: 'Grade RA', max_capacity: 1 });

    const res = await upload(
      csv('first_name,last_name,date_of_birth,class', `A,One,${birthYear}-01-01,Grade RA`, `B,Two,${birthYear}-01-02,Grade RA`),
      { dryRun: true }
    );

    expect(res.body.data.rows[0].errors).toEqual([]);
    expect(res.body.data.rows[1].errors[0].message).toMatch(/Grade RA is full/);
  });

  it('names the columns a file is missing', async () => {
    const res = await upload(csv('name,class', 'Amahle,Grade 1A'), { dryRun: true });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Last name, Date of birth/);
  });

  it('rejects other file types', async () => {
    const res = await upload('hello', { name: 'learners.txt', dryRun: true });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/CSV or Excel/);
  });

  it('asks for a file when none is sent', async () => {
    const res = await request(app).post('/api/school-admin/learners/import').set(headers).field('dry_run', 'true');

    expect(res.status).toBe(400);
  });
});

describe('importing', () => {
  it('imports the good rows, skips the rest and logs the import', async () => {
    const klass = await createClass({ school_id: admin.school_id, class_name: 'Grade 2B', grade_level: '2' });

    const res = await upload(
      csv(
        'first_name,last_name,date_of_birth,class,admission_number',
        `Lindiwe,Khumalo,${birthYear}-02-02,Grade 2B,EL-1`,
        `Thabo,Molefe,${birthYear}-04-04,,EL-2`,
        `Broken,Row,someday,,`
      )
    );

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('2 learners were imported; 1 row was skipped');
    expect(res.body.data.summary).toMatchObject({ imported: 2, withErrors: 1 });
    expect(res.body.data.rows.map((r) => r.line)).toEqual([4]);

    const { rows } = await pool.query(
      'SELECT first_name, current_class_id, admission_number FROM learners WHERE school_id = $1 ORDER BY first_name',
      [admin.school_id]
    );
    expect(rows).toEqual([
      { first_name: 'Lindiwe', current_class_id: klass.class_id, admission_number: 'EL-1' },
      { first_name: 'Thabo', current_class_id: null, admission_number: 'EL-2' },
    ]);
    const log = await pool.query('SELECT successful_records, failed_records FROM bulk_import_logs');
    expect(log.rows).toEqual([{ successful_records: 2, failed_records: 1 }]);
  });

  it('reads Excel files, including real date cells', async () => {
    const sheet = xlsx.utils.aoa_to_sheet(
      [
        ['First name', 'Last name', 'Date of birth'],
        ['Naledi', 'Mahlangu', new Date(birthYear, 6, 15)],
      ],
      { cellDates: true }
    );
    const book = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(book, sheet, 'Learners');
    const file = xlsx.write(book, { type: 'buffer', bookType: 'xlsx' });

    const res = await upload(file, { name: 'register.xlsx' });

    expect(res.status).toBe(201);
    const { rows } = await pool.query("SELECT date_of_birth FROM learners WHERE first_name = 'Naledi'");
    expect(rows[0].date_of_birth).toBe(`${birthYear}-07-15`);
  });

  it('refuses a file with nothing importable', async () => {
    const res = await upload(csv('first_name,last_name,date_of_birth', 'Only,Bad,never'));

    expect(res.status).toBe(400);
    expect((await pool.query('SELECT 1 FROM learners')).rows).toHaveLength(0);
  });
});
