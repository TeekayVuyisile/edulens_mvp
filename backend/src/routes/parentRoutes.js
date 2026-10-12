import express from 'express';
import { requireParent } from '../middleware/authMiddleware.js';
import { validateUuidParams } from '../middleware/validationMiddleware.js';
import { getChild, listChildren } from '../controllers/parent/childrenController.js';

const router = express.Router();

validateUuidParams(router, ['learnerId']);

router.use(requireParent);

router.get('/children', listChildren);
router.get('/children/:learnerId', getChild);

export default router;
