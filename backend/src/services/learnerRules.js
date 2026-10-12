import { body } from 'express-validator';

// What counts as a valid learner record, shared by the forms and the spreadsheet import.

// Foundation Phase is Grade R (age 5–6) to Grade 3 (age 8–9). The range is
// wider to allow early starters, late enrolments and learners repeating a grade.
export const MIN_LEARNER_AGE = 3;
export const MAX_LEARNER_AGE = 12;

export const GENDERS = ['Male', 'Female', 'Other'];

const GENDER_ALIASES = {
  male: 'Male', m: 'Male', boy: 'Male',
  female: 'Female', f: 'Female', girl: 'Female',
  other: 'Other',
};

/** "f", "girl", "FEMALE" → "Female"; returns null for anything else. */
export const normaliseGender = (value) => GENDER_ALIASES[String(value ?? '').trim().toLowerCase()] ?? null;

/** Whole years between `dateOfBirth` (YYYY-MM-DD) and `today`. */
export const ageOn = (dateOfBirth, today = new Date()) => {
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
  return age;
};

const optionalText = (field, max, label) =>
  body(field)
    .optional({ values: 'null' })
    .isString()
    .trim()
    .isLength({ max })
    .withMessage(`${label} must be ${max} characters or fewer`);

/**
 * express-validator chains for creating (all required fields) or updating
 * (every field optional) a learner.
 */
export const learnerValidation = ({ partial = false } = {}) => {
  const required = (chain) => (partial ? chain.optional() : chain);
  return [
    required(body('first_name'))
      .isString().trim().notEmpty().withMessage('Enter a first name')
      .isLength({ max: 100 }).withMessage('First name must be 100 characters or fewer'),
    required(body('last_name'))
      .isString().trim().notEmpty().withMessage('Enter a last name')
      .isLength({ max: 100 }).withMessage('Last name must be 100 characters or fewer'),
    required(body('date_of_birth'))
      .isISO8601({ strict: true }).withMessage('Enter a valid date of birth')
      .bail()
      .custom((value) => {
        const age = ageOn(value.slice(0, 10));
        if (age < MIN_LEARNER_AGE || age > MAX_LEARNER_AGE) {
          throw new Error(`Learners must be ${MIN_LEARNER_AGE}–${MAX_LEARNER_AGE} years old (this date gives ${age})`);
        }
        return true;
      }),
    body('gender')
      .optional({ values: 'falsy' })
      .isIn(GENDERS).withMessage('Choose Male, Female or Other'),
    optionalText('admission_number', 50, 'Admission number'),
    optionalText('guardian_name', 255, 'Guardian name'),
    body('guardian_email')
      .optional({ values: 'falsy' })
      .trim().toLowerCase().isEmail().withMessage('Enter a valid email address'),
    body('guardian_phone')
      .optional({ values: 'falsy' })
      .trim().matches(/^\+?[\d\s()-]{7,20}$/).withMessage('Enter a valid phone number'),
    body('has_special_needs').optional().isBoolean().toBoolean(),
    optionalText('special_needs_notes', 2000, 'Support notes'),
    optionalText('medical_notes', 2000, 'Medical notes'),
  ];
};
