import { body, param, query, validationResult } from 'express-validator';

export const validate = (validations) => {
   return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Format errors for better response
    const formattedErrors = errors.array().map(error => ({
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

// Common validation rules
export const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('first_name').notEmpty().trim(),
  body('last_name').notEmpty().trim(),
  body('role').isIn(['super_admin', 'school_admin', 'teacher', 'learner'])
];

export const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

export const schoolValidation = [
  body('school_name').notEmpty().trim().isLength({ min: 2, max: 255 }),
  body('contact_email').isEmail().normalizeEmail(),
  body('contact_phone').optional().isMobilePhone(),
  body('address').optional().trim(),
  body('city').optional().trim(),
  body('province').optional().trim()
];