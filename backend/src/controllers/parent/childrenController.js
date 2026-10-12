import Guardian from '../../models/Guardian.js';
import Learner from '../../models/Learner.js';
import { notFound } from '../../utils/httpError.js';
import { ok } from '../../utils/respond.js';

// The parent portal is read-only and shows only the parent's own children.
// Internal school notes (learning support, medical) are not shown here.

// GET /api/parent/children
export const listChildren = async (req, res) => {
  ok(res, { children: await Guardian.children(req.user.userId) });
};

// GET /api/parent/children/:learnerId — progress: averages per subject and every mark with the teacher's comment
export const getChild = async (req, res) => {
  const child = (await Guardian.children(req.user.userId)).find((c) => c.learner_id === req.params.learnerId);
  if (!child) throw notFound('Child not found');
  const [subjects, marks] = await Promise.all([
    Learner.performanceBySubject(child.learner_id),
    Learner.marks(child.learner_id),
  ]);
  ok(res, { child, subjects, marks });
};
