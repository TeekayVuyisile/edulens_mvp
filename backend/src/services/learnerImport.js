import { parse } from 'csv-parse/sync';
import xlsx from 'xlsx';
import pool from '../config/database.js';
import { badRequest } from '../utils/httpError.js';
import Learner, { CURRENT_STATUSES } from '../models/Learner.js';
import { withTransaction } from '../db/transaction.js';
import { onDuplicate } from '../utils/httpError.js';
import { ageOn, MAX_LEARNER_AGE, MIN_LEARNER_AGE, normaliseGender } from './learnerRules.js';

// Reads a class register exported from a spreadsheet, checks every row and
// says exactly what is wrong with each one, so the admin can fix the file
// (or just import the good rows) instead of guessing.

export const MAX_IMPORT_ROWS = 1000;

/** Accepted spellings of each column, after lower-casing and replacing spaces/punctuation with "_". */
const COLUMN_ALIASES = {
  first_name: ['first_name', 'firstname', 'first_names', 'name', 'learner_first_name', 'given_name'],
  last_name: ['last_name', 'lastname', 'surname', 'learner_surname', 'learner_last_name', 'family_name'],
  date_of_birth: ['date_of_birth', 'dob', 'birth_date', 'birthdate', 'birthday'],
  gender: ['gender', 'sex'],
  admission_number: ['admission_number', 'admission_no', 'admission', 'learner_number', 'student_number', 'lurits_number'],
  class_name: ['class', 'class_name', 'register_class'],
  guardian_name: ['guardian_name', 'guardian', 'parent_name', 'parent', 'parent_guardian'],
  guardian_phone: ['guardian_phone', 'parent_phone', 'phone', 'cell', 'cellphone', 'contact_number', 'guardian_cell', 'mobile'],
  guardian_email: ['guardian_email', 'parent_email', 'email'],
};

const FIELD_LABELS = {
  first_name: 'First name',
  last_name: 'Last name',
  date_of_birth: 'Date of birth',
  gender: 'Gender',
  admission_number: 'Admission number',
  class_name: 'Class',
  guardian_name: 'Guardian name',
  guardian_phone: 'Guardian phone',
  guardian_email: 'Guardian email',
};

const normaliseHeader = (header) =>
  String(header ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

const HEADER_TO_FIELD = new Map(
  Object.entries(COLUMN_ALIASES).flatMap(([field, aliases]) => aliases.map((alias) => [alias, field]))
);

const pad = (n) => String(n).padStart(2, '0');

/** Spreadsheet dates arrive as local-midnight Date objects (sometimes a few seconds early). */
const dateFromCell = (value) => {
  const shifted = new Date(value.getTime() + 12 * 60 * 60 * 1000);
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`;
};

/**
 * Accepts 2019-03-01, 2019/03/01 and the South African 01/03/2019 (day first).
 * Returns YYYY-MM-DD, or null when the text isn't a real date.
 */
export const parseDate = (text) => {
  const value = String(text ?? '').trim();
  let year;
  let month;
  let day;
  let match = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) [, year, month, day] = match;
  else {
    match = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (!match) return null;
    [, day, month, year] = match;
  }
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
};

/** Excel drops the leading 0 of SA cell numbers stored as numbers (821234567 → 0821234567). */
const phoneFromCell = (value) => {
  const text = String(value).trim();
  return /^[1-9]\d{8}$/.test(text) ? `0${text}` : text;
};

const cellText = (field, value) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return field === 'date_of_birth' ? dateFromCell(value) : '';
  if (field === 'guardian_phone') return phoneFromCell(value);
  return String(value).trim();
};

/**
 * Turns an uploaded CSV/XLSX file into { rows, unknownColumns }, where each row
 * maps our field names to trimmed text and `line` is the spreadsheet row number.
 */
export const readSpreadsheet = (file) => {
  const name = file.originalname.toLowerCase();
  let records;
  try {
    if (name.endsWith('.csv')) {
      records = parse(file.buffer, { columns: true, bom: true, skip_empty_lines: true, trim: true, relax_column_count: true });
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const workbook = xlsx.read(file.buffer, { type: 'buffer', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      records = xlsx.utils.sheet_to_json(sheet, { raw: true, defval: '', blankrows: false });
    } else {
      throw badRequest('Upload a CSV or Excel (.xlsx) file');
    }
  } catch (error) {
    if (error.statusCode) throw error;
    throw badRequest('This file couldn’t be read. Save it as CSV or Excel (.xlsx) and try again.');
  }

  if (records.length === 0) throw badRequest('The file has no learners in it');
  if (records.length > MAX_IMPORT_ROWS) {
    throw badRequest(`Import up to ${MAX_IMPORT_ROWS} learners at a time; this file has ${records.length}`);
  }

  const headers = Object.keys(records[0]);
  const fieldFor = Object.fromEntries(headers.map((h) => [h, HEADER_TO_FIELD.get(normaliseHeader(h))]));
  const mapped = new Set(Object.values(fieldFor).filter(Boolean));
  const missing = ['first_name', 'last_name', 'date_of_birth'].filter((field) => !mapped.has(field));
  if (missing.length > 0) {
    throw badRequest(
      `The file needs these columns: ${missing.map((f) => FIELD_LABELS[f]).join(', ')}. Download the template to see the layout.`,
      { missingColumns: missing }
    );
  }

  const rows = records.map((record, index) => {
    const row = { line: index + 2 }; // +1 for the header row, +1 because spreadsheets count from 1
    for (const [header, field] of Object.entries(fieldFor)) {
      if (field && !row[field]) row[field] = cellText(field, record[header]);
    }
    return row;
  });

  return { rows, unknownColumns: headers.filter((h) => !fieldFor[h] && String(h).trim() !== '') };
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s()-]{7,20}$/;
const nameKey = (first, last, dob) => `${first.toLowerCase()}|${last.toLowerCase()}|${dob}`;

/**
 * Checks parsed rows against the school's register and classes.
 * Every row comes back with `errors` (blocking) — an empty list means it will be imported.
 * With `classId`, every row goes into that class and any "class" column is ignored.
 */
export const checkRows = async (rows, schoolId, { today = new Date(), classId } = {}) => {
  const [{ rows: existing }, { rows: classes }] = await Promise.all([
    pool.query(
      `SELECT first_name, last_name, to_char(date_of_birth, 'YYYY-MM-DD') AS dob, LOWER(admission_number) AS admission
       FROM learners WHERE school_id = $1`,
      [schoolId]
    ),
    // Active classes, newest year first, so "Grade 1A" means this year's Grade 1A.
    pool.query(
      `SELECT c.class_id, c.class_name, c.grade_level, c.academic_year, c.max_capacity,
              (SELECT COUNT(*)::int FROM learners l
               WHERE l.current_class_id = c.class_id AND l.academic_status = ANY($2)) AS enrolled
       FROM classes c
       WHERE c.school_id = $1 AND c.is_active
       ORDER BY c.academic_year DESC`,
      [schoolId, CURRENT_STATUSES]
    ),
  ]);

  const knownNames = new Set(existing.map((l) => nameKey(l.first_name, l.last_name, l.dob)));
  const knownAdmissions = new Set(existing.map((l) => l.admission).filter(Boolean));
  const classByName = new Map();
  const classById = new Map();
  for (const klass of classes) {
    const entry = { ...klass, free: Math.max(0, klass.max_capacity - klass.enrolled) };
    classById.set(klass.class_id, entry);
    const key = klass.class_name.trim().toLowerCase();
    if (!classByName.has(key)) classByName.set(key, entry);
  }
  if (classId && !classById.has(classId)) throw badRequest('This class is no longer active');

  const seenNames = new Map();
  const seenAdmissions = new Map();

  return rows.map((row) => {
    const errors = [];
    const fail = (field, message) => errors.push({ field, message });
    const data = {
      first_name: row.first_name ?? '',
      last_name: row.last_name ?? '',
      date_of_birth: null,
      gender: null,
      admission_number: row.admission_number || null,
      guardian_name: row.guardian_name || null,
      guardian_phone: row.guardian_phone || null,
      guardian_email: row.guardian_email ? row.guardian_email.toLowerCase() : null,
      current_class_id: null,
    };

    if (!data.first_name) fail('first_name', 'First name is missing');
    else if (data.first_name.length > 100) fail('first_name', 'First name is too long');
    if (!data.last_name) fail('last_name', 'Last name is missing');
    else if (data.last_name.length > 100) fail('last_name', 'Last name is too long');

    if (!row.date_of_birth) fail('date_of_birth', 'Date of birth is missing');
    else {
      data.date_of_birth = parseDate(row.date_of_birth);
      if (!data.date_of_birth) fail('date_of_birth', `“${row.date_of_birth}” isn’t a date. Use YYYY-MM-DD or DD/MM/YYYY`);
      else {
        const age = ageOn(data.date_of_birth, today);
        if (age < MIN_LEARNER_AGE || age > MAX_LEARNER_AGE) {
          fail('date_of_birth', `Age ${age} is outside Grade R–3 (${MIN_LEARNER_AGE}–${MAX_LEARNER_AGE} years)`);
        }
      }
    }

    if (row.gender) {
      data.gender = normaliseGender(row.gender);
      if (!data.gender) fail('gender', `“${row.gender}” isn’t a gender we recognise. Use Male, Female or Other`);
    }

    if (data.guardian_email && !EMAIL.test(data.guardian_email)) fail('guardian_email', 'Guardian email isn’t valid');
    if (data.guardian_phone && !PHONE.test(data.guardian_phone)) fail('guardian_phone', 'Guardian phone isn’t valid');
    if (data.admission_number && data.admission_number.length > 50) fail('admission_number', 'Admission number is too long');

    // Duplicates: against the register, then earlier rows in this file.
    if (data.admission_number) {
      const key = data.admission_number.toLowerCase();
      if (knownAdmissions.has(key)) fail('admission_number', `Admission number ${data.admission_number} is already on the register`);
      else if (seenAdmissions.has(key)) {
        fail('admission_number', `Admission number ${data.admission_number} is also on row ${seenAdmissions.get(key)}`);
      } else seenAdmissions.set(key, row.line);
    }
    if (data.first_name && data.last_name && data.date_of_birth) {
      const key = nameKey(data.first_name, data.last_name, data.date_of_birth);
      if (knownNames.has(key)) fail('first_name', `${data.first_name} ${data.last_name} is already on the register`);
      else if (seenNames.has(key)) fail('first_name', `Same learner as row ${seenNames.get(key)}`);
      else seenNames.set(key, row.line);
    }

    let klass = classId ? classById.get(classId) : null;
    if (!classId && row.class_name) {
      klass = classByName.get(row.class_name.trim().toLowerCase());
      if (!klass) fail('class_name', `There’s no active class called “${row.class_name}”`);
    }

    // Only rows that will really be imported take a place in their class.
    if (klass && errors.length === 0) {
      if (klass.free === 0) fail('class_name', `${klass.class_name} is full (${klass.max_capacity} learners)`);
      else {
        klass.free -= 1;
        data.current_class_id = klass.class_id;
      }
    }

    return {
      line: row.line,
      data,
      class_name: klass?.class_name ?? (row.class_name || null),
      grade_level: klass?.grade_level ?? null,
      errors,
    };
  });
};

export const summarise = (checked) => ({
  total: checked.length,
  ready: checked.filter((r) => r.errors.length === 0).length,
  withErrors: checked.filter((r) => r.errors.length > 0).length,
});

/**
 * The whole import: read the file, check every row, and (unless dryRun)
 * add the error-free rows in one transaction and log the import.
 * @returns {{ summary, rows, unknownColumns }} — after a real run, rows are only those skipped
 */
export const importLearners = async ({ file, schoolId, importedBy, dryRun, classId }) => {
  if (!file) throw badRequest('Choose a CSV or Excel file to import');
  const { rows, unknownColumns } = readSpreadsheet(file);
  const checked = await checkRows(rows, schoolId, { classId });
  const ready = checked.filter((row) => row.errors.length === 0);
  const skipped = checked.filter((row) => row.errors.length > 0);

  if (dryRun) return { summary: summarise(checked), rows: checked, unknownColumns };
  if (ready.length === 0) throw badRequest('None of the rows can be imported. Fix the problems shown and try again.');

  await withTransaction(async (client) => {
    for (const row of ready) {
      await onDuplicate(
        Learner.create({ ...row.data, school_id: schoolId }, client),
        'Another learner already has this admission number'
      );
    }
    await client.query(
      `INSERT INTO bulk_import_logs (school_id, imported_by, import_type, file_name, total_records,
         successful_records, failed_records, error_details, import_status, completed_at)
       VALUES ($1, $2, 'learners', $3, $4, $5, $6, $7, 'completed', CURRENT_TIMESTAMP)`,
      [
        schoolId, importedBy, file.originalname, checked.length, ready.length, skipped.length,
        JSON.stringify(skipped.map(({ line, errors }) => ({ line, errors }))),
      ]
    );
  });

  return { summary: { ...summarise(checked), imported: ready.length }, rows: skipped, unknownColumns };
};

/** "3 learners were imported; 1 row was skipped" */
export const importMessage = ({ imported, withErrors }) =>
  `${imported} learner${imported === 1 ? ' was' : 's were'} imported` +
  (withErrors ? `; ${withErrors} row${withErrors === 1 ? ' was' : 's were'} skipped` : '');
