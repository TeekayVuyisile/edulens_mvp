import Curriculum from '../../models/Curriculum.js';
import { conflict, notFound, onDuplicate, onInUse } from '../../utils/httpError.js';
import { created, ok } from '../../utils/respond.js';

const LABELS = { curriculum: 'Curriculum', subject: 'Subject', topic: 'Topic' };

const DUPLICATE = {
  curriculum: 'A curriculum with this name already exists',
  subject: 'This curriculum already has a subject with that name for that grade',
  topic: 'This subject already has a topic with that name',
};

const IN_USE =
  'It’s used by assessments, worksheets or progress records, so it can’t be deleted. Archive it instead.';

// GET /api/super-admin/curricula?include_archived=true
export const listCurricula = async (req, res) => {
  const curricula = await Curriculum.tree({ includeArchived: req.query.include_archived === 'true' });
  ok(res, { curricula });
};

// POST /api/super-admin/curricula
export const createCurriculum = async (req, res) => {
  const curriculum = await onDuplicate(Curriculum.create(req.body), DUPLICATE.curriculum);
  created(res, { curriculum }, `${curriculum.curriculum_name} was added`);
};

// POST /api/super-admin/curricula/:curriculumId/subjects
export const createSubject = async (req, res) => {
  const { curriculumId } = req.params;
  if (!(await Curriculum.exists('curriculum', curriculumId))) throw notFound('Curriculum not found');
  const subject = await onDuplicate(Curriculum.createSubject(curriculumId, req.body), DUPLICATE.subject);
  created(res, { subject }, `${subject.subject_name} was added`);
};

// POST /api/super-admin/subjects/:subjectId/topics
export const createTopic = async (req, res) => {
  const { subjectId } = req.params;
  if (!(await Curriculum.exists('subject', subjectId))) throw notFound('Subject not found');
  const topic = await onDuplicate(Curriculum.createTopic(subjectId, req.body), DUPLICATE.topic);
  created(res, { topic }, `${topic.topic_name} was added`);
};

/** PUT, PATCH …/status and DELETE handlers for one level of the hierarchy. */
const itemHandlers = (kind, param) => ({
  update: async (req, res) => {
    const item = await onDuplicate(Curriculum.updateItem(kind, req.params[param], req.body), DUPLICATE[kind]);
    if (!item) throw notFound(`${LABELS[kind]} not found`);
    ok(res, { [kind]: item }, `${LABELS[kind]} saved`);
  },

  setStatus: async (req, res) => {
    const item = await Curriculum.setActive(kind, req.params[param], req.body.is_active);
    if (!item) throw notFound(`${LABELS[kind]} not found`);
    ok(res, { [kind]: item }, `${LABELS[kind]} ${item.is_active ? 'restored' : 'archived'}`);
  },

  remove: async (req, res) => {
    const result = await onInUse(Curriculum.deleteItem(kind, req.params[param]), IN_USE);
    if (result.reason === 'assigned') {
      throw conflict('This curriculum is assigned to schools. Remove those assignments or archive it instead.');
    }
    if (!result.deleted) throw notFound(`${LABELS[kind]} not found`);
    ok(res, undefined, `${LABELS[kind]} deleted`);
  },
});

export const curriculum = itemHandlers('curriculum', 'curriculumId');
export const subject = itemHandlers('subject', 'subjectId');
export const topic = itemHandlers('topic', 'topicId');
