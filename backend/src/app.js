import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Import middleware
import { activityLogger } from './middleware/activityLogger.js';
import { HttpError, fromDatabaseError } from './utils/httpError.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import superAdminRoutes from './routes/superAdminRoutes.js';
import schoolAdminRoutes from './routes/schoolAdminRoutes.js';
import teacherRoutes from './routes/teacherRoutes.js';
import curriculumRoutes from './routes/curriculumRoutes.js';

const app = express();
const isTest = process.env.NODE_ENV === 'test';

// Rate limiting (disabled under test so suites can make many requests)
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to max requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest
});

// Apply rate limiting to all requests
app.use(limiter);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: "same-site" }
}));

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Activity logging middleware (writes to the DB after each response; skipped under test)
if (!isTest) {
  app.use(activityLogger);
}

// Basic route for health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Edulens LMS API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/school-admin', schoolAdminRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/curriculum', curriculumRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Error handling middleware. Express 5 forwards errors thrown (or rejected)
// in async handlers here, so handlers can simply `throw notFound(...)`.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Malformed JSON bodies and oversized payloads come from body-parser.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ status: 'error', message: 'Request body is not valid JSON' });
  }

  const known = err instanceof HttpError ? err : fromDatabaseError(err);
  if (known) {
    return res.status(known.statusCode).json({
      status: 'error',
      message: known.message,
      ...known.details
    });
  }

  console.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(err.statusCode || err.status || 500).json({
    status: 'error',
    message: 'Something went wrong. Please try again.',
    ...(process.env.NODE_ENV === 'development' && { detail: err.message, stack: err.stack })
  });
});

export default app;
