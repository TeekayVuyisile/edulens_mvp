import pool from '../../config/database.js';
import School from '../../models/School.js';
import User from '../../models/User.js';
import { issueAccountLink } from '../../services/accountLinks.js';
import { badRequest, notFound, onDuplicate } from '../../utils/httpError.js';
import { buildUpdateSet } from '../../db/sql.js';
import { created, ok, pageParams } from '../../utils/respond.js';

const STAFF_ROLES = ['school_admin', 'teacher'];

const findStaffOr404 = async (userId) => {
  const user = await User.findStaffById(userId);
  if (!user || !STAFF_ROLES.includes(user.role)) throw notFound('User not found');
  return user;
};

const requireActiveSchool = async (schoolId) => {
  const school = await School.getById(schoolId);
  if (!school || !school.is_active) throw badRequest('Choose an active school');
  return school;
};

// GET /api/super-admin/users?search=&role=&status=&school_id=&page=&limit=
export const listUsers = async (req, res) => {
  const result = await User.listStaff({
    search: req.query.search?.trim() || undefined,
    role: STAFF_ROLES.includes(req.query.role) ? req.query.role : undefined,
    status: req.query.status,
    schoolId: req.query.school_id || undefined,
    ...pageParams(req.query),
  });
  ok(res, result);
};

// POST /api/super-admin/users — invite a school admin or teacher
export const inviteUser = async (req, res) => {
  const school = await requireActiveSchool(req.body.school_id);
  const user = await onDuplicate(User.createInvited(req.body), 'Someone already uses this email address');
  const invite = await issueAccountLink(user, { kind: 'invite', schoolName: school.school_name });
  created(res, { user, invite }, `${user.first_name} was invited`);
};

// GET /api/super-admin/users/:userId
export const getUser = async (req, res) => {
  const user = await findStaffOr404(req.params.userId);
  ok(res, { user });
};

// PUT /api/super-admin/users/:userId
export const updateUser = async (req, res) => {
  const existing = await findStaffOr404(req.params.userId);
  // Only a move needs an active destination; re-saving the current school is fine.
  if (req.body.school_id && req.body.school_id !== existing.school_id) {
    await requireActiveSchool(req.body.school_id);
  }

  // Role, password and status have their own endpoints.
  const { setClause, values, nextParam } = buildUpdateSet(req.body, [
    'first_name', 'last_name', 'email', 'phone', 'school_id',
  ]);
  if (setClause) {
    await onDuplicate(
      pool.query(`UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $${nextParam}`, [
        ...values,
        req.params.userId,
      ]),
      'Someone already uses this email address'
    );
  }
  const user = await User.findStaffById(req.params.userId);
  ok(res, { user }, 'User saved');
};

// PATCH /api/super-admin/users/:userId/status  { is_active: boolean }
export const setUserStatus = async (req, res) => {
  const existing = await findStaffOr404(req.params.userId);
  await pool.query('UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2', [
    req.body.is_active,
    existing.user_id,
  ]);
  const user = await User.findStaffById(existing.user_id);
  ok(
    res,
    { user },
    user.is_active
      ? `${user.first_name} can sign in again`
      : `${user.first_name} was deactivated and can no longer sign in`
  );
};

// POST /api/super-admin/users/:userId/account-link
// A fresh invitation if they've never signed in, otherwise a password reset link.
// Admins never choose or see other people's passwords.
export const sendAccountLink = async (req, res) => {
  const user = await findStaffOr404(req.params.userId);
  if (!user.is_active) throw badRequest('Activate this account first');

  const kind = user.last_login ? 'reset' : 'invite';
  const link = await issueAccountLink(user, { kind, schoolName: user.school_name });
  ok(
    res,
    { ...link, kind },
    kind === 'invite' ? 'A new invitation link is ready' : 'A password reset link is ready'
  );
};
