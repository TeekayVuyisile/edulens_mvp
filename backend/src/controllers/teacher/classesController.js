import pool from '../../config/database.js';
import Assessment from '../../models/Assessment.js';
import ClassModel from '../../models/Class.js';
import Learner from '../../models/Learner.js';
import { withTransaction } from '../../db/transaction.js';
import { importLearners, importMessage } from '../../services/learnerImport.js';
import { conflict, onDuplicate } from '../../utils/httpError.js';
import { created, ok } from '../../utils/respond.js';
import { requireRoomInClass } from '../schoolAdmin/scope.js';
import { findClassForTeacher, findLearnerForTeacher, requireActiveClass } from './scope.js';

// GET /api/teacher/dashboard — today's work: what to mark, classes, and what's coming up.
export const getDashboard = async (req, res) => {
  const teacherId = req.user.userId;

  // Active classes are this year's: closing a year deactivates its classes.
  const [classes, toMark, upcoming] = await Promise.all([
    ClassModel.forTeacher(teacherId),
    Assessment.listForTeacher(teacherId, { status: 'to_mark' }),
    pool.query(
      `SELECT a.assessment_id, a.assessment_name, a.assessment_type, a.scheduled_date, c.class_name, s.subject_name
       FROM assessments a
       JOIN classes c ON c.class_id = a.class_id
       JOIN class_teacher_assignments cta ON cta.class_id = a.class_id AND cta.teacher_id = $1
       LEFT JOIN subjects s ON s.subject_id = a.subject_id
       WHERE c.is_active AND a.scheduled_date >= CURRENT_DATE
       ORDER BY a.scheduled_date
       LIMIT 5`,
      [teacherId]
    ),
  ]);

  const averages = classes.filter((c) => c.average !== null);
  ok(res, {
    summary: {
      classes: classes.length,
      learners: classes.reduce((n, c) => n + c.learner_count, 0),
      to_mark: toMark.length,
      average: averages.length
        ? Math.round((averages.reduce((n, c) => n + c.average, 0) / averages.length) * 10) / 10
        : null,
    },
    classes,
    toMark: toMark.filter((a) => a.class_is_active).slice(0, 6),
    upcoming: upcoming.rows,
  });
};

// GET /api/teacher/classes?year=&include_inactive=true
export const listClasses = async (req, res) => {
  const classes = await ClassModel.forTeacher(req.user.userId, {
    year: Number(req.query.year) || undefined,
    includeInactive: req.query.include_inactive === 'true',
  });
  ok(res, { classes });
};

// GET /api/teacher/classes/:classId — the class and its learners (with their average in this class)
export const getClass = async (req, res) => {
  const klass = await findClassForTeacher(req.params.classId, req.user.userId);
  const learners = await ClassModel.learners(klass.class_id);
  ok(res, { class: klass, learners });
};

// GET /api/teacher/classes/:classId/marksheet?term=
export const getMarksheet = async (req, res) => {
  const klass = await findClassForTeacher(req.params.classId, req.user.userId);
  const sheet = await ClassModel.marksheet(klass.class_id, { term: req.query.term || undefined });
  ok(res, { class: klass, ...sheet });
};

const rejectDuplicateName = async (person, schoolId, exceptId = null) => {
  if (await Learner.isOnRegister(person, schoolId, exceptId)) {
    throw conflict(
      `${person.first_name.trim()} ${person.last_name.trim()} with this date of birth is already on the register. Ask your school admin to move them into your class.`
    );
  }
};

// POST /api/teacher/classes/:classId/learners — a new learner, placed in this class
export const addLearner = async (req, res) => {
  const klass = requireActiveClass(await findClassForTeacher(req.params.classId, req.user.userId));
  await rejectDuplicateName(req.body, req.user.schoolId);

  const learner = await withTransaction(async (client) => {
    await requireRoomInClass(klass.class_id, req.user.schoolId, 1, client);
    return onDuplicate(
      Learner.create({ ...req.body, school_id: req.user.schoolId, current_class_id: klass.class_id }, client),
      'Another learner already has this admission number'
    );
  });
  created(res, { learner }, `${learner.first_name} ${learner.last_name} was added to ${klass.class_name}`);
};

// POST /api/teacher/classes/:classId/learners/import (multipart: file, dry_run) — every row goes into this class
export const importLearnersToClass = async (req, res) => {
  const klass = requireActiveClass(await findClassForTeacher(req.params.classId, req.user.userId));
  const dryRun = String(req.body.dry_run) === 'true';
  const result = await importLearners({
    file: req.file,
    schoolId: req.user.schoolId,
    importedBy: req.user.userId,
    dryRun,
    classId: klass.class_id,
  });
  if (dryRun) ok(res, result);
  else created(res, result, importMessage(result.summary));
};

// GET /api/teacher/learners/:learnerId
export const getLearner = async (req, res) => {
  const learner = await findLearnerForTeacher(req.params.learnerId, req.user);
  const [history, performance, marks] = await Promise.all([
    Learner.history(learner.learner_id),
    Learner.performanceBySubject(learner.learner_id),
    Learner.marks(learner.learner_id),
  ]);
  ok(res, { learner, history, performance, marks });
};

// PUT /api/teacher/learners/:learnerId — details, guardian contacts and support notes
export const updateLearner = async (req, res) => {
  const existing = await findLearnerForTeacher(req.params.learnerId, req.user);
  const merged = {
    first_name: req.body.first_name ?? existing.first_name,
    last_name: req.body.last_name ?? existing.last_name,
    date_of_birth: req.body.date_of_birth ?? existing.date_of_birth,
  };
  if (['first_name', 'last_name', 'date_of_birth'].some((field) => merged[field] !== existing[field])) {
    await rejectDuplicateName(merged, req.user.schoolId, existing.learner_id);
  }
  await onDuplicate(Learner.update(existing.learner_id, req.body), 'Another learner already has this admission number');
  const learner = await Learner.findInSchool(existing.learner_id, req.user.schoolId);
  ok(res, { learner }, 'Learner saved');
};
