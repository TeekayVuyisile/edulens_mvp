import School from '../../models/School.js';
import Curriculum from '../../models/Curriculum.js';
import User from '../../models/User.js';
import { issueAccountLink } from '../../services/accountLinks.js';
import { conflict, notFound, onDuplicate } from '../../utils/httpError.js';
import { created, ok, pageParams } from '../../utils/respond.js';

const findSchoolOr404 = async (schoolId) => {
  const school = await School.getById(schoolId);
  if (!school) throw notFound('School not found');
  return school;
};

// GET /api/super-admin/schools?search=&status=active|inactive|no_admin&page=&limit=
export const listSchools = async (req, res) => {
  const result = await School.list({
    search: req.query.search?.trim() || undefined,
    status: req.query.status,
    ...pageParams(req.query),
  });
  ok(res, result);
};

// POST /api/super-admin/schools
export const createSchool = async (req, res) => {
  const school = await School.create(req.body);
  created(res, { school }, `${school.school_name} was added`);
};

// GET /api/super-admin/schools/:schoolId
export const getSchool = async (req, res) => {
  const school = await findSchoolOr404(req.params.schoolId);
  const [admins, curricula, stats] = await Promise.all([
    School.getAdmins(school.school_id),
    Curriculum.assignmentsForSchool(school.school_id),
    School.getStatistics(school.school_id),
  ]);
  ok(res, { school, admins, curricula, stats });
};

// PUT /api/super-admin/schools/:schoolId
export const updateSchool = async (req, res) => {
  await findSchoolOr404(req.params.schoolId);
  const school = await School.update(req.params.schoolId, req.body);
  ok(res, { school }, 'School details saved');
};

// PATCH /api/super-admin/schools/:schoolId/status  { is_active: boolean }
// Staff of an inactive school can't sign in (see authMiddleware).
export const setSchoolStatus = async (req, res) => {
  const school = await School.setActive(req.params.schoolId, req.body.is_active);
  if (!school) throw notFound('School not found');
  ok(
    res,
    { school },
    school.is_active
      ? `${school.school_name} is active again`
      : `${school.school_name} was deactivated. Its staff can no longer sign in.`
  );
};

// DELETE /api/super-admin/schools/:schoolId (only schools with nothing in them yet)
export const deleteSchool = async (req, res) => {
  const school = await findSchoolOr404(req.params.schoolId);
  const result = await School.deleteIfEmpty(school.school_id);
  if (!result.deleted) {
    throw conflict(
      'This school already has staff, classes or learners, so it can’t be deleted. Deactivate it instead.',
      { dependents: result.dependents }
    );
  }
  ok(res, undefined, `${school.school_name} was deleted`);
};

// POST /api/super-admin/schools/:schoolId/admins — invite a school admin
export const inviteSchoolAdmin = async (req, res) => {
  const school = await findSchoolOr404(req.params.schoolId);
  const user = await onDuplicate(
    User.createInvited({ ...req.body, role: 'school_admin', school_id: school.school_id }),
    'Someone already uses this email address'
  );
  const invite = await issueAccountLink(user, { kind: 'invite', schoolName: school.school_name });
  created(res, { user, invite }, `${user.first_name} was invited as a school admin`);
};

// POST /api/super-admin/schools/:schoolId/curricula
export const assignCurriculum = async (req, res) => {
  const school = await findSchoolOr404(req.params.schoolId);
  const { curriculum_id, grade_level, academic_year } = req.body;

  if (!(await Curriculum.exists('curriculum', curriculum_id, { activeOnly: true }))) {
    throw notFound('Curriculum not found or archived');
  }
  const current = await Curriculum.assignmentsForSchool(school.school_id);
  const duplicate = current.some(
    (a) =>
      a.curriculum_id === curriculum_id &&
      a.grade_level === grade_level &&
      a.academic_year === Number(academic_year)
  );
  if (duplicate) throw conflict('That curriculum is already assigned for this grade and year');

  const assignment = await Curriculum.assignToSchool({
    school_id: school.school_id,
    curriculum_id,
    grade_level,
    academic_year,
    assigned_by: req.user.userId,
  });
  created(res, { assignment }, 'Curriculum assigned');
};

// DELETE /api/super-admin/schools/:schoolId/curricula/:assignmentId
export const unassignCurriculum = async (req, res) => {
  const removed = await Curriculum.unassignFromSchool(req.params.schoolId, req.params.assignmentId);
  if (!removed) throw notFound('Assignment not found');
  ok(res, undefined, 'Curriculum removed from the school');
};
