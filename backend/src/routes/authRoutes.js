import express from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import {
  validate,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  updateProfileValidation,
} from '../middleware/validationMiddleware.js';

const router = express.Router();

// Tighter limit for credential endpoints to slow down password guessing.
// Successful logins don't count against it.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many attempts. Please try again in 15 minutes.' },
  skip: () => process.env.NODE_ENV === 'test',
});

// Public routes. There is deliberately no self-registration: accounts are
// created by a super admin (schools, school admins) or a school admin (teachers).
router.post('/login', credentialLimiter, validate(loginValidation), authController.login);
router.post('/forgot-password', credentialLimiter, validate(forgotPasswordValidation), authController.forgotPassword);
router.post('/reset-password', credentialLimiter, validate(resetPasswordValidation), authController.resetPassword);

// Any signed-in user
router.get('/profile', protect(), authController.getProfile);
router.put('/profile', protect(), validate(updateProfileValidation), authController.updateProfile);
router.post('/logout', protect(), authController.logout);

export default router;
