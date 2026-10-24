import 'dotenv/config';
import app from './src/app.js';
import pool from './src/config/database.js';

// Fail at boot, not on the first login.
const required = ['JWT_SECRET', ...(process.env.NODE_ENV === 'production' ? ['DATABASE_URL'] : [])];
for (const name of required) {
  if (!process.env[name]) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
}
if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
  console.warn('FRONTEND_URL is not set: invitation and reset links will point at http://localhost:5173.');
}

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Edulens LMS server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`${signal} signal received: closing HTTP server`);
  server.close(async () => {
    await pool.end();
    console.log('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
