import express from 'express';
import { validate } from '../middleware/validationMiddleware.js';
import { loginValidation } from '../middleware/validationMiddleware.js';
import * as authController from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js'; // Import from middleware

const router = express.Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', validate(loginValidation), authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Protected routes - use the correct protect middleware
router.get('/profile', protect, authController.getProfile);
router.put('/profile', protect, authController.updateProfile);

export default router;