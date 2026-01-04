import express from 'express';
import { requireSuperAdmin } from '../middleware/authMiddleware.js';
import * as superAdminController from '../controllers/superAdminController.js';
import { validate } from '../middleware/validationMiddleware.js';
import { body, param } from 'express-validator';

const router = express.Router();

// Apply super admin middleware to all routes
router.use(requireSuperAdmin);

// School Management
router.post('/schools',
  validate([
    body('school_name').notEmpty(),
    body('contact_email').isEmail(),
    body('contact_phone').optional().isMobilePhone()
  ]),
  superAdminController.createSchool
);

router.get('/schools', superAdminController.getSchools);
router.get('/schools/:schoolId', superAdminController.getSchoolById);
router.put('/schools/:schoolId', superAdminController.updateSchool);
router.delete('/schools/:schoolId', superAdminController.deleteSchool);

router.post('/schools/:schoolId/admin',
  validate([
    param('schoolId').isUUID(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('first_name').notEmpty(),
    body('last_name').notEmpty()
  ]),
  superAdminController.createSchoolAdmin
);

router.patch('/schools/:schoolId/toggle-active', superAdminController.toggleSchoolActivation);

// Curriculum Management
router.post('/curricula',
  validate([
    body('curriculum_name').notEmpty(),
    body('description').optional()
  ]),
  superAdminController.createCurriculum
);

router.get('/curricula', superAdminController.getCurricula);
router.get('/curricula/:curriculumId', superAdminController.getCurriculumById);
router.put('/curricula/:curriculumId', superAdminController.updateCurriculum);
router.delete('/curricula/:curriculumId', superAdminController.deleteCurriculum);

// Subject Management
router.post('/curricula/:curriculumId/subjects',
  validate([
    param('curriculumId').isUUID(),
    body('subject_name').notEmpty(),
    body('grade_level').isIn(['R', '1', '2', '3', 'R-3'])
  ]),
  superAdminController.addSubject
);

router.put('/subjects/:subjectId',
  validate([
    param('subjectId').isUUID()
  ]),
  superAdminController.updateSubject
);

router.delete('/subjects/:subjectId',
  validate([
    param('subjectId').isUUID()
  ]),
  superAdminController.deleteSubject
);

// Topic Management
router.post('/subjects/:subjectId/topics',
  validate([
    param('subjectId').isUUID(),
    body('topic_name').notEmpty()
  ]),
  superAdminController.addTopic
);

router.put('/topics/:topicId',
  validate([
    param('topicId').isUUID()
  ]),
  superAdminController.updateTopic
);

router.delete('/topics/:topicId',
  validate([
    param('topicId').isUUID()
  ]),
  superAdminController.deleteTopic
);

// School Curriculum Assignments
router.post('/schools/:schoolId/curricula',
  validate([
    param('schoolId').isUUID(),
    body('curriculum_id').isUUID(),
    body('grade_level').isIn(['R', '1', '2', '3', 'R-3']),
    body('academic_year').isInt({ min: 2000, max: 2100 })
  ]),
  superAdminController.assignCurriculumToSchool
);

router.get('/schools/:schoolId/curricula', superAdminController.getSchoolCurricula);
router.delete('/schools/:schoolId/curricula/:assignmentId', superAdminController.removeCurriculumFromSchool);

// Platform Statistics
router.get('/statistics', superAdminController.getPlatformStatistics);
router.get('/users', superAdminController.getAllUsers); // Correct
// Add these routes after the existing routes
router.post('/users',
  validate([
    body('email').isEmail(),
    body('password').optional().isLength({ min: 6 }),
    body('first_name').notEmpty(),
    body('last_name').notEmpty(),
    body('role').isIn(['school_admin', 'teacher', 'learner']),
    body('school_id').optional().isUUID()
  ]),
  superAdminController.createUser
);

router.get('/users/:userId', superAdminController.getUserById);

router.put('/users/:userId',
  validate([
    param('userId').isUUID(),
    body('first_name').optional().notEmpty(),
    body('last_name').optional().notEmpty(),
    body('phone').optional(),
    body('school_id').optional().isUUID()
  ]),
  superAdminController.updateUser
);

router.patch('/users/:userId/toggle-active', superAdminController.toggleUserActivation);

router.patch('/users/:userId/change-password',
  validate([
    param('userId').isUUID(),
    body('new_password').isLength({ min: 6 })
  ]),
  superAdminController.changeUserPassword
);

 // Temporary - will create proper user management

export default router;