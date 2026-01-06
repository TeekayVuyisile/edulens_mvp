import express from 'express';
import { requireTeacher } from '../middleware/authMiddleware.js';
import * as teacherController from '../controllers/teacherController.js';
import { validate } from '../middleware/validationMiddleware.js';
import { body, param } from 'express-validator';
import { uploadSingle } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Apply teacher middleware to all routes
router.use(requireTeacher);

// Dashboard
router.get('/dashboard', teacherController.getDashboard);

// Class Management
router.get('/classes/:classId', 
  param('classId').isUUID(),
  teacherController.getClassDetails
);

router.get('/classes/:classId/learners',
  param('classId').isUUID(),
  teacherController.getClassLearners
);

router.get('/classes/:classId/assessments',
  param('classId').isUUID(),
  teacherController.getClassAssessments
);

router.get('/classes/:classId/statistics',
  param('classId').isUUID(),
  teacherController.getClassStatistics
);

// Bulk Learners Management
router.post('/classes/:classId/learners/bulk',
  param('classId').isUUID(),
  validate([
    body('learners').isArray(),
    body('learners.*.first_name').notEmpty(),
    body('learners.*.last_name').notEmpty(),
    body('learners.*.date_of_birth').optional().isISO8601(),
    body('learners.*.gender').optional().isString(),
    body('learners.*.guardian_name').optional().isString(),
    body('learners.*.guardian_email').optional().isEmail(),
    body('learners.*.guardian_phone').optional().isString()
  ]),
  teacherController.bulkAddLearners
);

router.post('/learners/bulk-import',
  uploadSingle('file'),
  validate([
    body('class_id').isUUID()
  ]),
  teacherController.bulkImportLearners
);

// Assessment Management
router.post('/assessments',
  validate([
    body('class_id').isUUID(),
    body('assessment_name').notEmpty(),
    body('assessment_type').isIn(['test', 'quiz', 'project', 'worksheet', 'assignment']),
    body('total_marks').isNumeric(),
    body('term_number').isIn(['1', '2', '3', '4'])
  ]),
  teacherController.createAssessment
);

router.get('/assessments/:assessmentId/gradebook',
  param('assessmentId').isUUID(),
  teacherController.getAssessmentGradebook
);

router.post('/assessments/:assessmentId/bulk-grade',
  param('assessmentId').isUUID(),
  validate([
    body('grades').isArray(),
    body('grades.*.learner_id').isUUID(),
    body('grades.*.marks_obtained').optional().isNumeric(),
    body('grades.*.percentage').optional().isNumeric().custom(value => value >= 0 && value <= 100)
  ]),
  teacherController.bulkGradeAssessment
);

// Worksheet Management
router.post('/worksheets/generate',
  validate([
    body('curriculum_id').isUUID(),
    body('subject_id').isUUID(),
    body('topic_id').isUUID(),
    body('grade_level').isIn(['R', '1', '2', '3']),
    body('difficulty').isIn(['easy', 'medium', 'hard', 'mixed']),
    body('number_of_questions').isInt({ min: 1, max: 50 })
  ]),
  teacherController.generateWorksheet
);

router.post('/worksheets/save',
  validate([
    body('request_id').isUUID(),
    body('worksheet_title').notEmpty(),
    body('content_html').notEmpty()
  ]),
  teacherController.saveWorksheet
);

router.get('/worksheets/history', teacherController.getWorksheetHistory);
// Add to the existing bulk learners route validation:
router.post('/classes/:classId/learners/bulk',
  param('classId').isUUID(),
  validate([
    body('learners').isArray(),
    body('learners.*.first_name').notEmpty(),
    body('learners.*.last_name').notEmpty(),
    body('learners.*.date_of_birth').isISO8601(),
    body('learners.*.gender').optional().isString(),
    body('learners.*.guardian_name').optional().isString(),
    body('learners.*.guardian_email').optional().isEmail(),
    body('learners.*.guardian_phone').optional().isString(),
    body('learners.*.has_special_needs').optional().isBoolean(),
    body('learners.*.special_needs_notes').optional().isString(),
    body('learners.*.medical_notes').optional().isString()
  ]),
  teacherController.bulkAddLearners
);
// Learner Management
router.get('/learners/:learnerId',
  param('learnerId').isUUID(),
  teacherController.getLearnerProfile
);

export default router;