import pool from '../../config/database.js';
import ClassModel from '../../models/Class.js';
import Learner, { CURRENT_STATUSES } from '../../models/Learner.js';
import { withTransaction } from '../../db/transaction.js';
import { badRequest, conflict, notFound, onDuplicate } from '../../utils/httpError.js';
import { created, ok } from '../../utils/respond.js';
import { findClassOr404, requireActiveTeacher, requireRoomInClass } from './scope.js';

const duplicateName = (body) =>
  `There is already a class called ${body.class_name?.trim()} in ${body.academic_year ?? 'that year'}`;

// GET /api/school-admin/classes?year=&grade=&status=active|inactive|all
// Without a year, shows the school's current year (the newest year with active classes).
export const listClasses = async (req, res) => {
  const schoolId = req.user.schoolId;
  const [years, thisYear] = await Promise.all([ClassModel.years(schoolId), ClassModel.currentYear(schoolId)]);
  const year = Number(req.query.year) || thisYear;

  const classes = await ClassModel.listForSchool(schoolId, {
    year,
    grade: req.query.grade || undefined,
    status: req.query.status || 'active',
  });
  ok(res, { classes, year, years: [...new Set([thisYear, ...years])].sort((a, b) => b - a) });
};

// POST /api/school-admin/classes
export const createClass = async (req, res) => {
  const schoolId = req.user.schoolId;
  if (req.body.teacher_id) await requireActiveTeacher(req.body.teacher_id, schoolId);
  const klass = await onDuplicate(
    ClassModel.create({ ...req.body, school_id: schoolId }, req.user.userId),
    duplicateName(req.body)
  );
  created(res, { class: await ClassModel.findInSchool(klass.class_id, schoolId) }, `${klass.class_name} was created`);
};

// GET /api/school-admin/classes/:classId
export const getClass = async (req, res) => {
  const klass = await findClassOr404(req.params.classId, req.user.schoolId);
  const learners = await ClassModel.learners(klass.class_id);
  ok(res, { class: klass, learners });
};

// PUT /api/school-admin/classes/:classId
export const updateClass = async (req, res) => {
  const existing = await findClassOr404(req.params.classId, req.user.schoolId);
  if (req.body.max_capacity !== undefined && req.body.max_capacity < existing.learner_count) {
    throw badRequest(`${existing.class_name} already has ${existing.learner_count} learners`, {
      errors: [{ path: 'max_capacity', msg: `Can’t be less than the ${existing.learner_count} learners already in the class` }],
    });
  }
  await onDuplicate(
    ClassModel.update(existing.class_id, req.body),
    duplicateName({ class_name: req.body.class_name, academic_year: req.body.academic_year ?? existing.academic_year })
  );
  ok(res, { class: await ClassModel.findInSchool(existing.class_id, req.user.schoolId) }, 'Class saved');
};

// PATCH /api/school-admin/classes/:classId/status  { is_active: boolean }
export const setClassStatus = async (req, res) => {
  const existing = await findClassOr404(req.params.classId, req.user.schoolId);
  if (!req.body.is_active && existing.learner_count > 0) {
    throw conflict(
      `${existing.class_name} still has ${existing.learner_count} learner${existing.learner_count === 1 ? '' : 's'}. Move them to another class first.`
    );
  }
  await ClassModel.setActive(existing.class_id, req.body.is_active);
  const klass = await ClassModel.findInSchool(existing.class_id, req.user.schoolId);
  ok(res, { class: klass }, klass.is_active ? `${klass.class_name} is active again` : `${klass.class_name} was deactivated`);
};

// DELETE /api/school-admin/classes/:classId — only for classes created by mistake
export const deleteClass = async (req, res) => {
  const existing = await findClassOr404(req.params.classId, req.user.schoolId);
  const result = await ClassModel.deleteIfEmpty(existing.class_id);
  if (!result.deleted) {
    throw conflict(
      `${existing.class_name} has learners or assessments, so it can’t be deleted. Deactivate it instead.`,
      { dependents: result.dependents }
    );
  }
  ok(res, undefined, `${existing.class_name} was deleted`);
};

// POST /api/school-admin/classes/:classId/teachers  { teacher_id, is_primary }
export const assignTeacher = async (req, res) => {
  const klass = await findClassOr404(req.params.classId, req.user.schoolId);
  const teacher = await requireActiveTeacher(req.body.teacher_id, req.user.schoolId);
  const isPrimary = Boolean(req.body.is_primary);

  await withTransaction((client) =>
    ClassModel.setTeacher(klass.class_id, teacher.user_id, { isPrimary, assignedBy: req.user.userId }, client)
  );
  ok(
    res,
    { class: await ClassModel.findInSchool(klass.class_id, req.user.schoolId) },
    `${teacher.first_name} ${teacher.last_name} is ${isPrimary ? 'the class teacher' : 'now teaching'} for ${klass.class_name}`
  );
};

// DELETE /api/school-admin/classes/:classId/teachers/:teacherId
export const removeTeacher = async (req, res) => {
  const klass = await findClassOr404(req.params.classId, req.user.schoolId);
  const removed = await ClassModel.removeTeacher(klass.class_id, req.params.teacherId);
  if (!removed) throw notFound('That teacher isn’t assigned to this class');
  ok(res, { class: await ClassModel.findInSchool(klass.class_id, req.user.schoolId) }, `Teacher removed from ${klass.class_name}`);
};

// POST /api/school-admin/classes/:classId/learners  { learner_ids: uuid[] }
// Places learners (unplaced, or moving from another class) in this class.
export const addLearners = async (req, res) => {
  const schoolId = req.user.schoolId;
  const klass = await findClassOr404(req.params.classId, schoolId);
  const ids = [...new Set(req.body.learner_ids)];

  const { rows } = await pool.query(
    `SELECT learner_id, current_class_id FROM learners
     WHERE learner_id = ANY($1::uuid[]) AND school_id = $2 AND academic_status = ANY($3)`,
    [ids, schoolId, CURRENT_STATUSES]
  );
  if (rows.length !== ids.length) throw notFound('Some of these learners aren’t at your school');
  const moving = rows.filter((row) => row.current_class_id !== klass.class_id);

  await withTransaction(async (client) => {
    await requireRoomInClass(klass.class_id, schoolId, moving.length, client);
    for (const { learner_id: learnerId } of moving) await Learner.placeInClass(learnerId, klass.class_id, client);
  });

  ok(
    res,
    { class: await ClassModel.findInSchool(klass.class_id, schoolId) },
    `${moving.length} learner${moving.length === 1 ? ' was' : 's were'} added to ${klass.class_name}`
  );
};

// DELETE /api/school-admin/classes/:classId/learners/:learnerId — leaves the learner unplaced
export const removeLearner = async (req, res) => {
  const klass = await findClassOr404(req.params.classId, req.user.schoolId);
  const { rows } = await pool.query(
    'SELECT first_name, last_name FROM learners WHERE learner_id = $1 AND current_class_id = $2',
    [req.params.learnerId, klass.class_id]
  );
  if (!rows[0]) throw notFound('That learner isn’t in this class');
  await withTransaction((client) => Learner.placeInClass(req.params.learnerId, null, client));
  ok(res, undefined, `${rows[0].first_name} ${rows[0].last_name} was taken out of ${klass.class_name}`);
};
