/**
 * An error with an HTTP status that is safe to show to the client.
 * Throw it from a route handler; the error handler in app.js sends
 * { status: 'error', message, ...details } with this status.
 */
export class HttpError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const conflict = (message, details) => new HttpError(409, message, details);

// Postgres error codes we translate into client errors.
const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_INVALID_TEXT = '22P02';
const PG_CHECK_VIOLATION = '23514';

/**
 * Maps known database errors to an HttpError; returns null for anything else.
 * Lets handlers rely on constraints instead of racy "check then insert" code.
 */
export const fromDatabaseError = (error) => {
  switch (error?.code) {
    case PG_UNIQUE_VIOLATION:
      return conflict('A record with these details already exists');
    case PG_FOREIGN_KEY_VIOLATION:
      return conflict('This record is still in use by other records');
    case PG_INVALID_TEXT:
    case PG_CHECK_VIOLATION:
      return badRequest('Invalid value');
    default:
      return null;
  }
};

/** Awaits `promise`, turning a unique-constraint error into a 409 with `message`. */
export const onDuplicate = async (promise, message) => {
  try {
    return await promise;
  } catch (error) {
    if (error.code === PG_UNIQUE_VIOLATION) throw conflict(message);
    throw error;
  }
};

/** Awaits `promise`, turning a foreign-key error into a 409 with `message`. */
export const onInUse = async (promise, message) => {
  try {
    return await promise;
  } catch (error) {
    if (error.code === PG_FOREIGN_KEY_VIOLATION) throw conflict(message);
    throw error;
  }
};
