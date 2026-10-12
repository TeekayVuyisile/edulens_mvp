import { body, validationResult } from 'express-validator';

export const validate = (validations) => {
   return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Format errors for better response
    // One message per field: the first rule that failed.
    const formattedErrors = errors.array({ onlyFirstError: true }).map(error => ({
      type: error.type,
      value: error.value,
      msg: error.msg,
      path: error.path,
      location: error.location
    }));

    res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: formattedErrors
    });
  };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Rejects a request with 400 when any of the named route params (e.g. :classId)
 * is not a UUID, instead of letting Postgres fail with a 500.
 * Usage: validateUuidParams(router, ['classId', 'learnerId'])
 */
export const validateUuidParams = (router, names) => {
  for (const name of names) {
    router.param(name, (req, res, next, value) => {
      if (UUID.test(value)) return next();
      res.status(400).json({
        status: 'error',
        message: `Invalid ${name}`
      });
    });
  }
};

// Emails are trimmed and lower-cased only. (normalizeEmail() would also strip
// dots from Gmail addresses, so "first.last@gmail.com" could never sign in.)
const email = (field = 'email') =>
  body(field).trim().toLowerCase().isEmail().withMessage('Enter a valid email address');

export const PASSWORD_MIN_LENGTH = 8;

const newPassword = (field = 'password') =>
  body(field)
    .isString()
    .isLength({ min: PASSWORD_MIN_LENGTH })
    .withMessage(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);

export const loginValidation = [
  email(),
  body('password').notEmpty().withMessage('Password is required')
];

export const forgotPasswordValidation = [email()];

export const resetPasswordValidation = [
  body('token').isString().notEmpty().withMessage('Reset token is required'),
  newPassword()
];

export const updateProfileValidation = [
  body('first_name').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('last_name').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('phone').optional({ values: 'null' }).trim()
];
