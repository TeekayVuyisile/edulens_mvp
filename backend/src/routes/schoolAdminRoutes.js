import express from 'express';
import multer from 'multer';
import { body, query } from 'express-validator';
import { requireSchoolAdmin } from '../middleware/authMiddleware.js';
import { validate, validateUuidParams } from '../middleware/validationMiddleware.js';
import { CLASS_GRADES } from '../models/Class.js';
import { learnerValidation } from '../services/learnerRules.js';
import { badRequest } from '../utils/httpError.js';
import { getDashboard } from '../controllers/schoolAdmin/dashboardController.js';
import * as teachers from '../controllers/schoolAdmin/teachersController.js';
import * as learners from '../controllers/schoolAdmin/learnersController.js';
import * as classes from '../controllers/schoolAdmin/classesController.js';
import { getPerformance } from '../controllers/schoolAdmin/reportsController.js';

const router = express.Router();

validateUuidParams(router, ['classId', 'learnerId', 'teacherId']);

router.use(requireSchoolAdmin);

// ---- Shared rules ---------------------------------------------------------------

const requiredText = (field, label, max = 255) =>
  body(field).isString().trim().notEmpty().withMessage(`${label} is required`)
    .isLength({ max }).withMessage(`${label} must be ${max} characters or fewer`);

const email = (field = 'email', { optional = false } = {}) => {
  const chain = body(field);
  return (optional ? chain.optional() : chain)
    .trim().toLowerCase().isEmail().withMessage('Enter a valid email address');
};

const phone = (field) =>
  body(field).optional({ values: 'falsy' }).trim()
    .matches(/^\+?[\d\s()-]{7,20}$/).withMessage('Enter a valid phone number');

const isActive = body('is_active').isBoolean({ strict: true }).withMessage('is_active must be true or false');

const pagination = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

const uuidBody = (field, label) => body(field).isUUID().withMessage(`Choose a ${label}`);

// Spreadsheets are read from memory (never written to disk) and capped at 2 MB.
const spreadsheet = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });
const uploadSpreadsheet = (req, res, next) =>
  spreadsheet.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return next(badRequest('The file is larger than 2 MB. Split it into smaller files.'));
    if (error instanceof multer.MulterError) return next(badRequest('Upload one CSV or Excel file in the “file” field'));
    return next(error);
  });

// ---- Dashboard ------------------------------------------------------------------

router.get('/dashboard', getDashboard);

// ---- Teachers -------------------------------------------------------------------

router.get('/teachers', validate([
  query('status').optional().isIn(['active', 'pending', 'inactive']),
  ...pagination,
]), teachers.listTeachers);

router.post('/teachers', validate([
  requiredText('first_name', 'First name', 100),
  requiredText('last_name', 'Last name', 100),
  email(),
  phone('phone'),
]), teachers.inviteTeacher);

router.get('/teachers/:teacherId', teachers.getTeacher);

router.put('/teachers/:teacherId', validate([
  requiredText('first_name', 'First name', 100).optional(),
  requiredText('last_name', 'Last name', 100).optional(),
  email('email', { optional: true }),
  phone('phone'),
]), teachers.updateTeacher);

router.patch('/teachers/:teacherId/status', validate([isActive]), teachers.setTeacherStatus);
router.post('/teachers/:teacherId/account-link', teachers.sendAccountLink);

// ---- Learners -------------------------------------------------------------------

router.get('/learners', validate([
  query('status').optional().isIn(['current', 'unplaced', 'left', 'all']),
  query('class_id').optional().isUUID(),
  query('grade').optional().isIn(CLASS_GRADES),
  ...pagination,
]), learners.listLearners);

router.post('/learners', validate([
  ...learnerValidation(),
  body('class_id').optional({ values: 'falsy' }).isUUID().withMessage('Choose a class'),
]), learners.createLearner);

// Registered before /learners/:learnerId so "import" isn't read as an id.
router.post('/learners/import', uploadSpreadsheet, learners.importLearners);

router.get('/learners/:learnerId', learners.getLearner);
router.put('/learners/:learnerId', validate(learnerValidation({ partial: true })), learners.updateLearner);
router.delete('/learners/:learnerId', learners.deleteLearner);

router.patch('/learners/:learnerId/status', validate([
  body('academic_status').isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
]), learners.setLearnerStatus);

router.patch('/learners/:learnerId/class', validate([
  body('class_id').optional({ values: 'null' }).isUUID().withMessage('Choose a class'),
]), learners.setLearnerClass);

// ---- Classes --------------------------------------------------------------------

const classRules = (creating) => {
  const maybe = (chain) => (creating ? chain : chain.optional());
  return [
    maybe(requiredText('class_name', 'Class name', 100)),
    maybe(body('grade_level')).isIn(CLASS_GRADES).withMessage('Choose Grade R, 1, 2 or 3'),
    maybe(body('academic_year')).isInt({ min: 2000, max: 2100 }).withMessage('Enter a year such as 2026').toInt(),
    body('max_capacity').optional().isInt({ min: 1, max: 60 }).withMessage('Capacity must be between 1 and 60').toInt(),
  ];
};

router.get('/classes', validate([
  query('year').optional().isInt({ min: 2000, max: 2100 }),
  query('grade').optional().isIn(CLASS_GRADES),
  query('status').optional().isIn(['active', 'inactive', 'all']),
]), classes.listClasses);

router.post('/classes', validate([
  ...classRules(true),
  body('teacher_id').optional({ values: 'falsy' }).isUUID().withMessage('Choose a teacher'),
]), classes.createClass);

router.get('/classes/:classId', classes.getClass);
router.put('/classes/:classId', validate(classRules(false)), classes.updateClass);
router.patch('/classes/:classId/status', validate([isActive]), classes.setClassStatus);
router.delete('/classes/:classId', classes.deleteClass);

router.post('/classes/:classId/teachers', validate([
  uuidBody('teacher_id', 'teacher'),
  body('is_primary').optional().isBoolean({ strict: true }),
]), classes.assignTeacher);
router.delete('/classes/:classId/teachers/:teacherId', classes.removeTeacher);

router.post('/classes/:classId/learners', validate([
  body('learner_ids').isArray({ min: 1, max: 200 }).withMessage('Choose at least one learner'),
  body('learner_ids.*').isUUID().withMessage('Invalid learner id'),
]), classes.addLearners);
router.delete('/classes/:classId/learners/:learnerId', classes.removeLearner);

// ---- Reports --------------------------------------------------------------------

router.get('/reports/performance', validate([
  query('year').optional().isInt({ min: 2000, max: 2100 }),
  query('grade').optional().isIn(CLASS_GRADES),
  query('term').optional().isIn(['1', '2', '3', '4']),
]), getPerformance);

export default router;
