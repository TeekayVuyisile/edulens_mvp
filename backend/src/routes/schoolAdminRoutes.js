import express from 'express';
import { requireSchoolAdmin } from '../middleware/authMiddleware.js';
import * as schoolAdminController from '../controllers/schoolAdminController.js';
import { validate, validateUuidParams } from '../middleware/validationMiddleware.js';
import { body, param } from 'express-validator';
import multer from 'multer';

const router = express.Router();

validateUuidParams(router, ['classId', 'learnerId', 'teacherId']);
const upload = multer({ dest: 'uploads/' });

// Apply school admin middleware to all routes
router.use(requireSchoolAdmin);

// Dashboard
router.get('/dashboard', schoolAdminController.getDashboard);

// User Management
router.post('/teachers',
  validate([
    body('email').isEmail(),
    body('first_name').notEmpty(),
    body('last_name').notEmpty(),
    body('phone').optional().isMobilePhone()
  ]),
  schoolAdminController.createTeacher
);

router.post('/teachers/bulk-import',
  upload.single('file'),
  schoolAdminController.bulkImportTeachers
);

router.get('/teachers', schoolAdminController.getTeachers);

// Update the create learner validation - FIXED VERSION
router.post('/learners',
  validate([
    body('first_name').notEmpty().trim(),
    body('last_name').notEmpty().trim(),
    body('date_of_birth').isISO8601(),
    body('gender').optional().isIn(['Male', 'Female', 'Other', 'Prefer not to say']),
    body('current_class_id').optional({ nullable: true, checkFalsy: true }).isUUID(),
    body('guardian_email').optional({ nullable: true, checkFalsy: true }).isEmail(),
    body('guardian_phone').optional({ nullable: true, checkFalsy: true }).isMobilePhone(),
    body('has_special_needs').optional({ nullable: true, checkFalsy: true }).isBoolean(),
    body('special_needs_notes').optional({ nullable: true, checkFalsy: true }).isString(),
    body('medical_notes').optional({ nullable: true, checkFalsy: true }).isString()
  ]),
  schoolAdminController.createLearner
);
// Add this route with other learner routes
router.get('/learners/:learnerId',
  schoolAdminController.getLearnerById
);

router.post('/learners/bulk-import',
  upload.single('file'),
  schoolAdminController.bulkImportLearners
);

router.get('/learners', schoolAdminController.getLearners);

// Class Management
router.post('/classes',
  validate([
    body('class_name').notEmpty(),
    body('grade_level').isIn(['R', '1', '2', '3']),
    body('academic_year').isInt({ min: 2000, max: 2100 }),
    body('primary_teacher_id').optional().isUUID()
  ]),
  schoolAdminController.createClass
);

router.get('/classes', schoolAdminController.getClasses);
router.get('/classes/:classId', schoolAdminController.getClassDetails);
router.put('/classes/:classId', schoolAdminController.updateClass);

// Academic Progress
router.post('/learners/:learnerId/progress',
  validate([
    body('action').isIn(['promote', 'repeat']),
    body('next_class_id').optional().isUUID()
  ]),
  schoolAdminController.updateLearnerProgress
);

// Reports
router.get('/reports/performance',
  schoolAdminController.getPerformanceReports
);

router.get('/reports/worksheets',
  schoolAdminController.getWorksheetReports
);
// Add these routes after existing class routes

// Teacher assignments
router.post('/classes/:classId/assign-teacher',
  validate([
    body('teacher_id').isUUID(),
    body('is_primary').optional().isBoolean()
  ]),
  schoolAdminController.assignTeacherToClass
);

router.delete('/classes/:classId/teachers/:teacherId',
  schoolAdminController.removeTeacherFromClass
);

router.get('/classes/:classId/teachers', schoolAdminController.getClassTeachers);

// Class details
router.get('/classes/:classId/learners', schoolAdminController.getClassLearners);
router.get('/classes/:classId/curriculum', schoolAdminController.getClassCurriculum);
router.get('/classes/:classId/analytics', schoolAdminController.getClassAnalytics);

// Teacher list for dropdowns
router.get('/teachers/list', schoolAdminController.getTeachersList);

// Academic year management
router.get('/academic-years', schoolAdminController.getAcademicYears);
router.post('/academic-years/:year/archive',
  param('year').isInt({ min: 2000, max: 2100 }),
  schoolAdminController.archiveAcademicYear
);   
// Add these routes after existing class routes

// Learner assignment routes
router.post('/classes/:classId/assign-learner',
  validate([
    body('learner_id').isUUID()
  ]),
  schoolAdminController.assignLearnerToClass
);

router.delete('/classes/:classId/learners/:learnerId',
  schoolAdminController.removeLearnerFromClass
);

router.get('/classes/:classId/available-learners',
  schoolAdminController.getAvailableLearners
);

// Class status toggle route
router.patch('/classes/:classId/toggle-status',
  validate([
    body('is_active').isBoolean()
  ]),
  schoolAdminController.toggleClassStatus
);               
// Teacher management routes
router.get('/teachers/:teacherId',
  schoolAdminController.getTeacherById
);

router.put('/teachers/:teacherId',
  validate([
    body('email').optional().isEmail(),
    body('first_name').optional().notEmpty(),
    body('last_name').optional().notEmpty(),
    body('phone').optional().isMobilePhone(),
    body('is_active').optional().isBoolean()
  ]),
  schoolAdminController.updateTeacher
);

router.patch('/teachers/:teacherId/password',
  validate([
    body('new_password').isLength({ min: 6 })
  ]),
  schoolAdminController.changeTeacherPassword
);

router.patch('/teachers/:teacherId/toggle-active',
  validate([
    body('is_active').isBoolean()
  ]),
  schoolAdminController.toggleTeacherActiveStatus
);

router.get('/teachers/:teacherId/classes',
  schoolAdminController.getTeacherClasses
);
// Learner management routes
router.get('/learners/:learnerId/performance',
  schoolAdminController.getLearnerPerformance
);

router.put('/learners/:learnerId',
  validate([
    body('first_name').notEmpty(),
    body('last_name').notEmpty(),
    body('date_of_birth').isISO8601(),
    body('academic_status').isIn(['active', 'archived', 'graduated', 'repeated', 'inactive'])
  ]),
  schoolAdminController.updateLearner
);

router.patch('/learners/:learnerId/status',
  validate([
    body('academic_status').isIn(['active', 'archived', 'graduated', 'repeated', 'inactive'])
  ]),
  schoolAdminController.updateLearnerStatus
);
export default router;