import Learner, { CURRENT_STATUSES } from '../../models/Learner.js';
import { importLearners, importMessage } from '../../services/learnerImport.js';
import { withTransaction } from '../../db/transaction.js';
import { badRequest, conflict, onDuplicate } from '../../utils/httpError.js';
import { created, ok, pageParams } from '../../utils/respond.js';
import { findLearnerOr404, requireRoomInClass } from './scope.js';

const DUPLICATE_ADMISSION = 'Another learner already has this admission number';

const rejectDuplicateName = async (person, schoolId, exceptId = null) => {
  if (await Learner.isOnRegister(person, schoolId, exceptId)) {
    throw conflict(
      `${person.first_name.trim()} ${person.last_name.trim()} with this date of birth is already on the register.`
    );
  }
};

// GET /api/school-admin/learners?search=&status=current|unplaced|left|all&class_id=&grade=&page=&limit=
export const listLearners = async (req, res) => {
  const result = await Learner.list(req.user.schoolId, {
    search: req.query.search?.trim() || undefined,
    status: req.query.status || 'current',
    classId: req.query.class_id || undefined,
    grade: req.query.grade || undefined,
    ...pageParams(req.query, { defaultLimit: 25 }),
  });
  ok(res, result);
};

// POST /api/school-admin/learners
export const createLearner = async (req, res) => {
  const schoolId = req.user.schoolId;
  await rejectDuplicateName(req.body, schoolId);

  const learner = await withTransaction(async (client) => {
    if (req.body.class_id) await requireRoomInClass(req.body.class_id, schoolId, 1, client);
    return onDuplicate(
      Learner.create({ ...req.body, school_id: schoolId, current_class_id: req.body.class_id || null }, client),
      DUPLICATE_ADMISSION
    );
  });
  created(res, { learner }, `${learner.first_name} ${learner.last_name} was added`);
};

// GET /api/school-admin/learners/:learnerId
export const getLearner = async (req, res) => {
  const learner = await findLearnerOr404(req.params.learnerId, req.user.schoolId);
  const [history, performance] = await Promise.all([
    Learner.history(learner.learner_id),
    Learner.performanceBySubject(learner.learner_id),
  ]);
  ok(res, { learner, history, performance });
};

// PUT /api/school-admin/learners/:learnerId
export const updateLearner = async (req, res) => {
  const existing = await findLearnerOr404(req.params.learnerId, req.user.schoolId);
  const merged = {
    first_name: req.body.first_name ?? existing.first_name,
    last_name: req.body.last_name ?? existing.last_name,
    date_of_birth: req.body.date_of_birth ?? existing.date_of_birth,
  };
  // Only a change of name or birthday can create a duplicate.
  if (['first_name', 'last_name', 'date_of_birth'].some((field) => merged[field] !== existing[field])) {
    await rejectDuplicateName(merged, req.user.schoolId, existing.learner_id);
  }
  await onDuplicate(Learner.update(existing.learner_id, req.body), DUPLICATE_ADMISSION);
  const learner = await Learner.findInSchool(existing.learner_id, req.user.schoolId);
  ok(res, { learner }, 'Learner saved');
};

// PATCH /api/school-admin/learners/:learnerId/status  { academic_status: 'active' | 'inactive' }
// "inactive" means the learner left the school; they are taken out of their class.
export const setLearnerStatus = async (req, res) => {
  const existing = await findLearnerOr404(req.params.learnerId, req.user.schoolId);
  const leaving = req.body.academic_status === 'inactive';

  await withTransaction(async (client) => {
    if (leaving) await Learner.placeInClass(existing.learner_id, null, client);
    await Learner.setStatus(existing.learner_id, req.body.academic_status, client);
  });
  const learner = await Learner.findInSchool(existing.learner_id, req.user.schoolId);
  const name = `${learner.first_name} ${learner.last_name}`;
  ok(
    res,
    { learner },
    leaving ? `${name} was marked as having left the school` : `${name} is back on the register. Place them in a class.`
  );
};

// PATCH /api/school-admin/learners/:learnerId/class  { class_id: uuid | null }
export const setLearnerClass = async (req, res) => {
  const schoolId = req.user.schoolId;
  const existing = await findLearnerOr404(req.params.learnerId, schoolId);
  if (!CURRENT_STATUSES.includes(existing.academic_status)) {
    throw badRequest('Only learners at the school can be placed in a class');
  }
  const classId = req.body.class_id ?? null;

  const klass = await withTransaction(async (client) => {
    let target = null;
    if (classId && classId !== existing.current_class_id) {
      target = await requireRoomInClass(classId, schoolId, 1, client);
    }
    await Learner.placeInClass(existing.learner_id, classId, client);
    return target;
  });

  const learner = await Learner.findInSchool(existing.learner_id, schoolId);
  const name = `${learner.first_name} ${learner.last_name}`;
  ok(res, { learner }, classId ? `${name} is now in ${klass?.class_name ?? learner.class_name}` : `${name} was taken out of their class`);
};

// DELETE /api/school-admin/learners/:learnerId — only for learners added by mistake
export const deleteLearner = async (req, res) => {
  const existing = await findLearnerOr404(req.params.learnerId, req.user.schoolId);
  const result = await Learner.deleteIfUnmarked(existing.learner_id);
  if (!result.deleted) {
    throw conflict(
      `${existing.first_name} already has marks recorded, so they can’t be deleted. Mark them as having left instead.`
    );
  }
  ok(res, undefined, `${existing.first_name} ${existing.last_name} was deleted`);
};

// POST /api/school-admin/learners/import  (multipart: file, dry_run=true|false)
// A dry run returns every row with its problems; a real run imports the rows without problems.
export const importLearnersFromFile = async (req, res) => {
  const dryRun = String(req.body.dry_run) === 'true';
  const result = await importLearners({
    file: req.file,
    schoolId: req.user.schoolId,
    importedBy: req.user.userId,
    dryRun,
  });
  if (dryRun) ok(res, result);
  else created(res, result, importMessage(result.summary));
};
