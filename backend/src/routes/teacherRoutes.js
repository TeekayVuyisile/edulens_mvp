import express from 'express';
import { body, query } from 'express-validator';
import { requireTeacher } from '../middleware/authMiddleware.js';
import { validate, validateUuidParams } from '../middleware/validationMiddleware.js';
import { uploadResource, uploadSpreadsheet } from '../middleware/uploadMiddleware.js';
import { ASSESSMENT_TYPES, TERMS } from '../models/Assessment.js';
import { learnerValidation } from '../services/learnerRules.js';
import * as classes from '../controllers/teacher/classesController.js';
import * as assessments from '../controllers/teacher/assessmentsController.js';
import * as worksheets from '../controllers/teacher/worksheetsController.js';

const router = express.Router();

validateUuidParams(router, ['assessmentId', 'classId', 'learnerId', 'requestId', 'resourceId']);

router.use(requireTeacher);

// ---- Dashboard and classes --------------------------------------------------------

router.get('/dashboard', classes.getDashboard);

router.get('/classes', validate([query('year').optional().isInt({ min: 2000, max: 2100 })]), classes.listClasses);
router.get('/classes/:classId', classes.getClass);
router.get('/classes/:classId/marksheet', validate([query('term').optional().isIn(TERMS)]), classes.getMarksheet);
router.post('/classes/:classId/learners', validate(learnerValidation()), classes.addLearner);
router.post('/classes/:classId/learners/import', uploadSpreadsheet, classes.importLearnersToClass);

router.get('/learners/:learnerId', classes.getLearner);
router.put('/learners/:learnerId', validate(learnerValidation({ partial: true })), classes.updateLearner);

// ---- Assessments ------------------------------------------------------------------

const optionalUuid = (field, label) =>
  body(field).optional({ values: 'falsy' }).isUUID().withMessage(`Choose a ${label}`);

const assessmentRules = (creating) => {
  const maybe = (chain) => (creating ? chain : chain.optional());
  return [
    maybe(body('assessment_name')).isString().trim().notEmpty().withMessage('Give the assessment a name')
      .isLength({ max: 255 }).withMessage('Name must be 255 characters or fewer'),
    maybe(body('assessment_type')).isIn(ASSESSMENT_TYPES).withMessage('Choose a type'),
    maybe(body('total_marks')).isFloat({ gt: 0, max: 1000 }).withMessage('Total marks must be between 1 and 1000').toFloat(),
    maybe(body('term_number')).isIn(TERMS).withMessage('Choose a term'),
    optionalUuid('subject_id', 'subject'),
    optionalUuid('topic_id', 'topic'),
    body('scheduled_date').optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('Enter a valid date'),
    body('due_date').optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('Enter a valid date'),
    body('description').optional({ values: 'null' }).isString().isLength({ max: 2000 }),
  ];
};

router.get('/assessments', validate([
  query('class_id').optional().isUUID(),
  query('term').optional().isIn(TERMS),
  query('status').optional().isIn(['to_mark', 'marked']),
  query('year').optional().isInt({ min: 2000, max: 2100 }),
]), assessments.listAssessments);

router.get('/assessments/options', validate([query('class_id').isUUID().withMessage('Choose a class')]), assessments.getOptions);

router.post('/assessments', validate([
  body('class_id').isUUID().withMessage('Choose a class'),
  ...assessmentRules(true),
]), assessments.createAssessment);

router.get('/assessments/:assessmentId', assessments.getAssessment);
router.put('/assessments/:assessmentId', validate(assessmentRules(false)), assessments.updateAssessment);
router.delete('/assessments/:assessmentId', assessments.deleteAssessment);

router.get('/assessments/:assessmentId/marks', assessments.getMarks);
router.put('/assessments/:assessmentId/marks', validate([
  body('marks').isArray({ min: 1, max: 200 }).withMessage('Send at least one mark'),
  body('marks.*.learner_id').isUUID().withMessage('Invalid learner id'),
  body('marks.*.marks_obtained')
    .custom((value) => value === null || (Number.isFinite(Number(value)) && Number(value) >= 0))
    .withMessage('Marks must be a number from 0, or empty'),
  body('marks.*.teacher_feedback').optional({ values: 'null' }).isString().isLength({ max: 1000 }),
]), assessments.saveMarks);

router.post('/assessments/:assessmentId/resources', uploadResource, assessments.addResource);
router.get('/assessments/:assessmentId/resources/:resourceId/download', assessments.downloadResource);
router.delete('/assessments/:assessmentId/resources/:resourceId', assessments.deleteResource);

// ---- AI worksheets (rebuilt in Phase 6) ---------------------------------------------

router.post('/worksheets/generate', validate([
  body('curriculum_id').isUUID(),
  body('subject_id').isUUID(),
  body('topic_id').isUUID(),
  body('grade_level').isIn(['R', '1', '2', '3']),
  body('difficulty').isIn(['easy', 'medium', 'hard', 'mixed']),
  body('number_of_questions').isInt({ min: 1, max: 50 }),
]), worksheets.generateWorksheet);

router.post('/worksheets/save', validate([
  body('request_id').isUUID(),
  body('worksheet_title').notEmpty(),
  body('content_html').notEmpty(),
]), worksheets.saveWorksheet);

router.get('/worksheets/options', worksheets.getWorksheetOptions);
router.get('/worksheets/history', worksheets.getWorksheetHistory);
router.get('/worksheets/history/:requestId', worksheets.getWorksheetDetails);
router.get('/worksheets/saved', worksheets.getSavedWorksheets);

export default router;
