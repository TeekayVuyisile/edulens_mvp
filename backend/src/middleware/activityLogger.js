import pool from '../config/database.js';

// Only changes are worth an audit trail; page views (GET) would flood the table.
const LOGGED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Request bodies for these endpoints carry credentials and are never stored.
const UNLOGGED_BODY_PATHS = /^\/api\/auth\//;

const SENSITIVE_KEY = /pass(word)?|token|secret|authorization/i;

/** Deep copy of `value` with credential-looking fields replaced. */
export const redact = (value) => {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(inner)])
    );
  }
  return value;
};

/** The activity_logs row for a finished request, or null if it shouldn't be logged. */
export const buildLogEntry = (req, res, durationMs) => {
  if (!LOGGED_METHODS.has(req.method)) return null;

  const path = req.originalUrl.split('?')[0];
  return {
    user_id: req.user?.userId ?? null,
    school_id: req.user?.schoolId ?? null,
    action_type: `${req.method} ${path}`,
    action_details: {
      method: req.method,
      path,
      body: UNLOGGED_BODY_PATHS.test(path) ? null : redact(req.body ?? null),
      statusCode: res.statusCode,
      duration: `${durationMs}ms`,
    },
    ip_address: req.ip,
    user_agent: req.get('user-agent') ?? null,
  };
};

export const activityLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const entry = buildLogEntry(req, res, Date.now() - start);
    if (!entry) return;

    // Fire and forget: logging must never slow down or fail a request.
    pool
      .query(
        `INSERT INTO activity_logs (user_id, school_id, action_type, action_details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          entry.user_id,
          entry.school_id,
          entry.action_type,
          JSON.stringify(entry.action_details),
          entry.ip_address,
          entry.user_agent,
        ]
      )
      .catch((error) => console.error('Error logging activity:', error.message));
  });

  next();
};
