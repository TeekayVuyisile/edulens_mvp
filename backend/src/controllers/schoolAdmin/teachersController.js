import pool from '../../config/database.js';
import School from '../../models/School.js';
import User from '../../models/User.js';
import { buildUpdateSet } from '../../db/sql.js';
import { issueAccountLink } from '../../services/accountLinks.js';
import { badRequest, onDuplicate } from '../../utils/httpError.js';
import { created, ok, pageParams } from '../../utils/respond.js';
import { findTeacherOr404 } from './scope.js';

/** Active classes per teacher: { [teacherId]: [{ class_id, class_name, grade_level, is_primary }] } */
const classesByTeacher = async (teacherIds) => {
  if (teacherIds.length === 0) return {};
  const { rows } = await pool.query(
    `SELECT cta.teacher_id, c.class_id, c.class_name, c.grade_level, c.academic_year, cta.is_primary
     FROM class_teacher_assignments cta
     JOIN classes c ON c.class_id = cta.class_id
     WHERE cta.teacher_id = ANY($1::uuid[]) AND c.is_active
     ORDER BY c.academic_year DESC, CASE c.grade_level WHEN 'R' THEN 0 ELSE 1 END, c.grade_level, c.class_name`,
    [teacherIds]
  );
  const grouped = {};
  for (const { teacher_id: teacherId, ...klass } of rows) (grouped[teacherId] ??= []).push(klass);
  return grouped;
};

// GET /api/school-admin/teachers?search=&status=active|pending|inactive&page=&limit=
export const listTeachers = async (req, res) => {
  const result = await User.listStaff({
    role: 'teacher',
    schoolId: req.user.schoolId,
    search: req.query.search?.trim() || undefined,
    status: req.query.status,
    ...pageParams(req.query),
  });
  const classes = await classesByTeacher(result.users.map((u) => u.user_id));
  const teachers = result.users.map(({ school_name: _s, school_code: _c, ...teacher }) => ({
    ...teacher,
    classes: classes[teacher.user_id] ?? [],
  }));
  ok(res, { teachers, counts: result.counts, pagination: result.pagination });
};

// POST /api/school-admin/teachers — invite a teacher (they choose their own password)
export const inviteTeacher = async (req, res) => {
  const school = await School.getById(req.user.schoolId);
  const teacher = await onDuplicate(
    User.createInvited({ ...req.body, role: 'teacher', school_id: req.user.schoolId }),
    'Someone already uses this email address'
  );
  const invite = await issueAccountLink(teacher, { kind: 'invite', schoolName: school?.school_name });
  created(res, { teacher, invite }, `${teacher.first_name} was invited`);
};

// GET /api/school-admin/teachers/:teacherId
export const getTeacher = async (req, res) => {
  const teacher = await findTeacherOr404(req.params.teacherId, req.user.schoolId);
  const [classes, { rows }] = await Promise.all([
    classesByTeacher([teacher.user_id]),
    pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM assessments WHERE teacher_id = $1) AS assessments,
         (SELECT COUNT(*)::int FROM grades WHERE graded_by = $1) AS marks_recorded`,
      [teacher.user_id]
    ),
  ]);
  ok(res, { teacher, classes: classes[teacher.user_id] ?? [], stats: rows[0] });
};

// PUT /api/school-admin/teachers/:teacherId
export const updateTeacher = async (req, res) => {
  await findTeacherOr404(req.params.teacherId, req.user.schoolId);
  const { setClause, values, nextParam } = buildUpdateSet(req.body, ['first_name', 'last_name', 'email', 'phone']);
  if (setClause) {
    await onDuplicate(
      pool.query(`UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $${nextParam}`, [
        ...values,
        req.params.teacherId,
      ]),
      'Someone already uses this email address'
    );
  }
  const teacher = await User.findStaffById(req.params.teacherId);
  ok(res, { teacher }, 'Teacher saved');
};

// PATCH /api/school-admin/teachers/:teacherId/status  { is_active: boolean }
// Class assignments are kept, so a returning teacher picks up where they left off.
export const setTeacherStatus = async (req, res) => {
  const existing = await findTeacherOr404(req.params.teacherId, req.user.schoolId);
  await pool.query('UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2', [
    req.body.is_active,
    existing.user_id,
  ]);
  const teacher = await User.findStaffById(existing.user_id);
  ok(
    res,
    { teacher },
    teacher.is_active
      ? `${teacher.first_name} can sign in again`
      : `${teacher.first_name} was deactivated and can no longer sign in`
  );
};

// POST /api/school-admin/teachers/:teacherId/account-link
// A new invitation if they've never signed in, otherwise a password reset link.
export const sendAccountLink = async (req, res) => {
  const teacher = await findTeacherOr404(req.params.teacherId, req.user.schoolId);
  if (!teacher.is_active) throw badRequest('Activate this teacher first');

  const kind = teacher.last_login ? 'reset' : 'invite';
  const link = await issueAccountLink(teacher, { kind, schoolName: teacher.school_name });
  ok(
    res,
    { ...link, kind },
    kind === 'invite' ? 'A new invitation link is ready' : 'A password reset link is ready'
  );
};
