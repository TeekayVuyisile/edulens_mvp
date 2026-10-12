import express from 'express';
import { validateUuidParams } from '../middleware/validationMiddleware.js';
import * as curriculumController from '../controllers/curriculumController.js';

const router = express.Router();

validateUuidParams(router, ['curriculumId', 'subjectId']);

// Public routes (available to all authenticated users)
router.get('/', curriculumController.getCurricula);
router.get('/:curriculumId', curriculumController.getCurriculumById);
router.get('/:curriculumId/subjects', curriculumController.getSubjectsByCurriculum);
router.get('/subjects/:subjectId/topics', curriculumController.getTopicsBySubject);

export default router;