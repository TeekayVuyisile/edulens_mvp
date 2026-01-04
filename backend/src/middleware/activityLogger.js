import pool from '../config/database.js';

export const activityLogger = async (req, res, next) => {
  const start = Date.now();

  // Store the original end function
  const originalEnd = res.end;

  // Create a buffer to store the response body
  const chunks = [];

  // Override the end function to capture the response
  res.end = function (chunk, encoding) {
    if (chunk) {
      chunks.push(Buffer.from(chunk, encoding));
    }

    // Call the original end function
    originalEnd.apply(res, arguments);

    // Log the activity after response is sent
    const duration = Date.now() - start;
    logActivity(req, res, duration);
  };

  next();
};

async function logActivity(req, res, duration) {
  try {
    // Skip logging for health checks and static files
    if (req.path === '/api/health' || req.path.includes('.')) {
      return;
    }

    const userId = req.user?.userId;
    const schoolId = req.user?.schoolId;

    const actionDetails = {
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.method === 'POST' || req.method === 'PUT' ? req.body : null,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    };

    const query = `
      INSERT INTO activity_logs 
      (user_id, school_id, action_type, action_details, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    await pool.query(query, [
      userId,
      schoolId,
      `${req.method} ${req.path}`,
      JSON.stringify(actionDetails),
      req.ip,
      req.get('user-agent')
    ]);
  } catch (error) {
    console.error('Error logging activity:', error);
    // Don't throw error - logging failures shouldn't affect the main request
  }
}