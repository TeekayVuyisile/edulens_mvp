import express from 'express';
import { body, query } from 'express-validator';
import { requireSuperAdmin } from '../middleware/authMiddleware.js';
import { validate, validateUuidParams } from '../middleware/validationMiddleware.js';
import { GRADE_LEVELS } from '../models/Curriculum.js';
import * as schools from '../controllers/superAdmin/schoolsController.js';
import * as curricula from '../controllers/superAdmin/curriculaController.js';
import * as users from '../controllers/superAdmin/usersController.js';
import { getPlatformStatistics } from '../controllers/superAdmin/statisticsController.js';

const router = express.Router();

validateUuidParams(router, ['assignmentId', 'curriculumId', 'schoolId', 'subjectId', 'topicId', 'userId']);

router.use(requireSuperAdmin);

// ---- Shared rules ---------------------------------------------------------------

export const PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
  'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape',
];

const requiredText = (field, label, max = 255) =>
  body(field).isString().trim().notEmpty().withMessage(`${label} is required`)
    .isLength({ max }).withMessage(`${label} is too long`);

const optionalText = (field, max = 2000) =>
  body(field).optional({ values: 'null' }).isString().trim().isLength({ max });

const email = (field = 'email', { optional = false } = {}) => {
  const chain = body(field);
  return (optional ? chain.optional() : chain)
    .trim().toLowerCase().isEmail().withMessage('Enter a valid email address');
};

const phone = (field) =>
  body(field).optional({ values: 'falsy' }).trim()
    .matches(/^\+?[\d\s()-]{7,20}$/).withMessage('Enter a valid phone number');

const isActive = body('is_active').isBoolean({ strict: true }).withMessage('is_active must be true or false');

const gradeLevel = (field = 'grade_level', { optional = false } = {}) => {
  const chain = body(field);
  return (optional ? chain.optional() : chain)
    .isIn(GRADE_LEVELS).withMessage(`Grade must be one of ${GRADE_LEVELS.join(', ')}`);
};

const pagination = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

// ---- Dashboard ------------------------------------------------------------------

router.get('/statistics', getPlatformStatistics);

// ---- Schools --------------------------------------------------------------------

const schoolRules = (creating) => [
  creating ? requiredText('school_name', 'School name') : requiredText('school_name', 'School name').optional(),
  creating ? email('contact_email') : email('contact_email', { optional: true }),
  phone('contact_phone'),
  optionalText('address', 500),
  optionalText('city', 100),
  body('province').optional({ values: 'falsy' }).isIn(PROVINCES).withMessage('Choose a South African province'),
  optionalText('country', 100),
];

const staffInviteRules = [
  requiredText('first_name', 'First name', 100),
  requiredText('last_name', 'Last name', 100),
  email(),
  phone('phone'),
];

router.get('/schools', validate([
  query('status').optional().isIn(['active', 'inactive', 'no_admin']),
  ...pagination,
]), schools.listSchools);
router.post('/schools', validate(schoolRules(true)), schools.createSchool);
router.get('/schools/:schoolId', schools.getSchool);
router.put('/schools/:schoolId', validate(schoolRules(false)), schools.updateSchool);
router.patch('/schools/:schoolId/status', validate([isActive]), schools.setSchoolStatus);
router.delete('/schools/:schoolId', schools.deleteSchool);
router.post('/schools/:schoolId/admins', validate(staffInviteRules), schools.inviteSchoolAdmin);

router.post('/schools/:schoolId/curricula', validate([
  body('curriculum_id').isUUID().withMessage('Choose a curriculum'),
  gradeLevel(),
  body('academic_year').isInt({ min: 2000, max: 2100 }).withMessage('Enter a valid year').toInt(),
]), schools.assignCurriculum);
router.delete('/schools/:schoolId/curricula/:assignmentId', schools.unassignCurriculum);

// ---- Curricula, subjects, topics -------------------------------------------------

router.get('/curricula', curricula.listCurricula);
router.post('/curricula', validate([
  requiredText('curriculum_name', 'Curriculum name'),
  optionalText('description'),
]), curricula.createCurriculum);
router.put('/curricula/:curriculumId', validate([
  requiredText('curriculum_name', 'Curriculum name').optional(),
  optionalText('description'),
]), curricula.curriculum.update);
router.patch('/curricula/:curriculumId/status', validate([isActive]), curricula.curriculum.setStatus);
router.delete('/curricula/:curriculumId', curricula.curriculum.remove);

const subjectRules = (creating) => [
  creating ? requiredText('subject_name', 'Subject name') : requiredText('subject_name', 'Subject name').optional(),
  optionalText('subject_code', 50),
  gradeLevel('grade_level', { optional: !creating }),
  optionalText('description'),
];
router.post('/curricula/:curriculumId/subjects', validate(subjectRules(true)), curricula.createSubject);
router.put('/subjects/:subjectId', validate(subjectRules(false)), curricula.subject.update);
router.patch('/subjects/:subjectId/status', validate([isActive]), curricula.subject.setStatus);
router.delete('/subjects/:subjectId', curricula.subject.remove);

const topicRules = (creating) => [
  creating ? requiredText('topic_name', 'Topic name') : requiredText('topic_name', 'Topic name').optional(),
  optionalText('topic_code', 50),
  optionalText('description'),
  optionalText('learning_objectives'),
];
router.post('/subjects/:subjectId/topics', validate(topicRules(true)), curricula.createTopic);
router.put('/topics/:topicId', validate(topicRules(false)), curricula.topic.update);
router.patch('/topics/:topicId/status', validate([isActive]), curricula.topic.setStatus);
router.delete('/topics/:topicId', curricula.topic.remove);

// ---- Staff accounts --------------------------------------------------------------

router.get('/users', validate([
  query('role').optional().isIn(['school_admin', 'teacher']),
  query('status').optional().isIn(['active', 'inactive', 'pending']),
  query('school_id').optional().isUUID(),
  ...pagination,
]), users.listUsers);
router.post('/users', validate([
  ...staffInviteRules,
  body('role').isIn(['school_admin', 'teacher']).withMessage('Choose School Admin or Teacher'),
  body('school_id').isUUID().withMessage('Choose a school'),
]), users.inviteUser);
router.get('/users/:userId', users.getUser);
router.put('/users/:userId', validate([
  requiredText('first_name', 'First name', 100).optional(),
  requiredText('last_name', 'Last name', 100).optional(),
  email('email', { optional: true }),
  phone('phone'),
  body('school_id').optional().isUUID().withMessage('Choose a school'),
]), users.updateUser);
router.patch('/users/:userId/status', validate([isActive]), users.setUserStatus);
router.post('/users/:userId/account-link', users.sendAccountLink);

export default router;
