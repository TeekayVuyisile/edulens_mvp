import express from 'express';
import { requireTeacher, requireSchoolAdmin, requireAdminOrTeacher } from '../middleware/authMiddleware.js';
import * as learnerController from '../controllers/learnerController.js';
import { param } from 'express-validator';
import { validate } from '../middleware/validationMiddleware.js';

const router = express.Router();

// Routes for teachers and admins
router.get('/:learnerId',
  param('learnerId').isUUID(),
  requireAdminOrTeacher,
  learnerController.getLearnerProfile
);

router.put('/:learnerId',
  param('learnerId').isUUID(),
  requireSchoolAdmin,
  learnerController.updateLearner
);

// Route for learner to view their own profile
router.get('/me/profile',
  (req, res, next) => {
    if (req.user.role !== 'learner') {
      return res.status(403).json({
        status: 'error',
        message: 'Only learners can access this endpoint'
      });
    }
    next();
  },
  learnerController.getMyProfile
);

export default router;