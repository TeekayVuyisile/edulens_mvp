import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { validateUuidParams } from '../middleware/validationMiddleware.js';
import * as curriculumController from '../controllers/curriculumController.js';

const router = express.Router();

validateUuidParams(router, ['curriculumId', 'subjectId']);

// Read-only curriculum data for any signed-in user
router.use(protect());

router.get('/', curriculumController.getCurricula);
router.get('/:curriculumId', curriculumController.getCurriculumById);
router.get('/:curriculumId/subjects', curriculumController.getSubjectsByCurriculum);
router.get('/subjects/:subjectId/topics', curriculumController.getTopicsBySubject);

export default router;