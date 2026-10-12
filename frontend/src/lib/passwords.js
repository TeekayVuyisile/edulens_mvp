// Mirrors the server rule in backend/src/middleware/validationMiddleware.js.
export const PASSWORD_MIN_LENGTH = 8;

/** Field errors for a new password + confirmation; empty object when valid. */
export const validatePasswords = ({ password, confirm }) => {
  const errors = {};
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (confirm !== password) {
    errors.confirm = 'Passwords don’t match.';
  }
  return errors;
};
