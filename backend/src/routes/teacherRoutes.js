import express from 'express';
import { requireTeacher } from '../middleware/authMiddleware.js';
import * as teacherController from '../controllers/teacherController.js';
import { validate, validateUuidParams } from '../middleware/validationMiddleware.js';
import { body } from 'express-validator';
import { uploadSingle } from '../middleware/uploadMiddleware.js';

const router = express.Router();

validateUuidParams(router, ['assessmentId', 'classId', 'learnerId', 'requestId', 'resourceId']);

// Apply teacher middleware to all routes
router.use(requireTeacher);

// Dashboard
router.get('/dashboard', teacherController.getDashboard);

// Class Management
router.get('/classes/:classId', 
  teacherController.getClassDetails
);

router.get('/classes/:classId/learners',
  teacherController.getClassLearners
);

router.get('/classes/:classId/assessments',
  teacherController.getClassAssessments
);

router.get('/classes/:classId/statistics',
  teacherController.getClassStatistics
);

// Bulk Learners Management
router.post('/classes/:classId/learners/bulk',
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

router.post('/learners/bulk-import',
  uploadSingle('file'),
  validate([
    body('class_id').isUUID()
  ]),
  teacherController.bulkImportLearners
);

// Assessment Management
router.get('/assessment-data', teacherController.getAssessmentData);

router.get('/assessments', teacherController.getAssessments);

router.post('/assessments',
  validate([
    body('class_id').isUUID(),
    body('assessment_name').notEmpty(),
    body('assessment_type').isIn(['test', 'quiz', 'project', 'worksheet', 'assignment']),
    body('total_marks').isNumeric(),
    body('term_number').isIn(['1', '2', '3', '4']),
    body('subject_id').optional().isUUID(),
    body('topic_id').optional().isUUID(),
    body('curriculum_id').optional().isUUID(),
    body('passing_marks').optional().isNumeric(),
    body('due_date').optional().isISO8601(),
    body('scheduled_date').optional().isISO8601(),
    body('description').optional().isString(),
    body('academic_year').optional().isInt()
  ]),
  teacherController.createAssessment
);

router.get('/assessments/:assessmentId',
  teacherController.getAssessment
);

router.put('/assessments/:assessmentId',
  validate([
    body('assessment_name').optional().notEmpty(),
    body('total_marks').optional().isNumeric(),
    body('due_date').optional().isISO8601(),
    body('scheduled_date').optional().isISO8601(),
    body('description').optional().isString()
  ]),
  teacherController.updateAssessment
);

router.delete('/assessments/:assessmentId',
  teacherController.deleteAssessment
);

router.get('/assessments/:assessmentId/gradebook',
  teacherController.getAssessmentGradebook
);

router.post('/assessments/:assessmentId/bulk-grade',
  validate([
    body('grades').isArray(),
    body('grades.*.learner_id').isUUID(),
    body('grades.*.marks_obtained').optional().isNumeric(),
    body('grades.*.percentage').optional().isNumeric().custom(value => value >= 0 && value <= 100)
  ]),
  teacherController.bulkGradeAssessment
);

// Assessment Resources Routes
router.post('/assessments/:assessmentId/resources',
  uploadSingle('resource'),
  teacherController.uploadAssessmentResource
);

router.delete('/assessments/:assessmentId/resources/:resourceId',
  teacherController.deleteAssessmentResource
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
router.get('/worksheets/history/:requestId', teacherController.getWorksheetDetails);
router.get('/worksheets/saved', teacherController.getSavedWorksheets);

// Learner Management
router.get('/learners/:learnerId',
  teacherController.getLearnerProfile
);

export default router;