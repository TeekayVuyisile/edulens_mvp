import pool from '../../config/database.js';
import Guardian from '../../models/Guardian.js';
import School from '../../models/School.js';
import User from '../../models/User.js';
import { issueAccountLink } from '../../services/accountLinks.js';
import { badRequest, conflict, notFound } from '../../utils/httpError.js';
import { created, ok } from '../../utils/respond.js';
import { findLearnerOr404 } from './scope.js';

/** "Zanele Dlamini" → { first: 'Zanele', last: 'Dlamini' } (for prefilling from the learner record). */
const splitName = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
};

// GET /api/school-admin/learners/:learnerId/guardians
export const listGuardians = async (req, res) => {
  const learner = await findLearnerOr404(req.params.learnerId, req.user.schoolId);
  ok(res, { guardians: await Guardian.forLearner(learner.learner_id) });
};

// POST /api/school-admin/learners/:learnerId/guardians  { email, first_name?, last_name?, phone?, relationship? }
// Invites a new parent account, or links an existing parent (e.g. a sibling's) to this learner.
export const inviteGuardian = async (req, res) => {
  const learner = await findLearnerOr404(req.params.learnerId, req.user.schoolId);
  const email = req.body.email;
  const school = await School.getById(learner.school_id);
  const childName = `${learner.first_name} ${learner.last_name}`;

  const existing = await Guardian.findByEmail(email);
  if (existing && existing.role !== 'parent') {
    throw conflict('This email belongs to a staff account. Use a different email address for the parent.', {
      errors: [{ path: 'email', msg: 'This email belongs to a staff account' }],
    });
  }

  if (existing) {
    const linked = await Guardian.link(existing.user_id, learner.learner_id, {
      relationship: req.body.relationship,
      invitedBy: req.user.userId,
    });
    if (!linked) throw conflict(`${existing.first_name} is already linked to ${learner.first_name}`);
    if (!existing.is_active) {
      await pool.query('UPDATE users SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1', [existing.user_id]);
    }
    // Someone who has never signed in gets a fresh invitation; others just see the child next time.
    const invite = existing.last_login ? null : await issueAccountLink(existing, { kind: 'invite', schoolName: school?.school_name });
    created(
      res,
      { guardian: existing, invite },
      invite
        ? `${existing.first_name} was linked to ${childName}. A new invitation is ready.`
        : `${existing.first_name} already has an account and will see ${childName} next time they sign in`
    );
    return;
  }

  // A new parent account. Names default to the guardian name on the learner record.
  const fromRecord = splitName(learner.guardian_name ?? '');
  const firstName = req.body.first_name?.trim() || fromRecord.first;
  const lastName = req.body.last_name?.trim() || fromRecord.last;
  if (!firstName || !lastName) {
    throw badRequest('Enter the parent’s first and last name', {
      errors: [
        ...(!firstName ? [{ path: 'first_name', msg: 'Enter a first name' }] : []),
        ...(!lastName ? [{ path: 'last_name', msg: 'Enter a last name' }] : []),
      ],
    });
  }

  const guardian = await User.createInvited({
    email,
    first_name: firstName,
    last_name: lastName,
    phone: req.body.phone || learner.guardian_phone,
    role: 'parent',
    school_id: null,
  });
  await Guardian.link(guardian.user_id, learner.learner_id, { relationship: req.body.relationship, invitedBy: req.user.userId });
  const invite = await issueAccountLink(guardian, { kind: 'invite', schoolName: school?.school_name });
  created(res, { guardian, invite }, `${guardian.first_name} was invited to follow ${childName}`);
};

const findLinkedGuardian = async (req) => {
  const learner = await findLearnerOr404(req.params.learnerId, req.user.schoolId);
  if (!(await Guardian.isLinked(req.params.guardianId, learner.learner_id))) throw notFound('That parent isn’t linked to this learner');
  return { learner, guardian: await User.findStaffById(req.params.guardianId) };
};

// POST /api/school-admin/learners/:learnerId/guardians/:guardianId/account-link
export const sendGuardianLink = async (req, res) => {
  const { learner, guardian } = await findLinkedGuardian(req);
  if (!guardian.is_active) throw badRequest('This parent’s account is deactivated');
  const school = await School.getById(learner.school_id);
  const kind = guardian.last_login ? 'reset' : 'invite';
  const link = await issueAccountLink(guardian, { kind, schoolName: school?.school_name });
  ok(res, { ...link, kind }, kind === 'invite' ? 'A new invitation link is ready' : 'A password reset link is ready');
};

// DELETE /api/school-admin/learners/:learnerId/guardians/:guardianId
export const removeGuardian = async (req, res) => {
  const { learner, guardian } = await findLinkedGuardian(req);
  await Guardian.unlink(guardian.user_id, learner.learner_id);
  ok(res, undefined, `${guardian.first_name} can no longer see ${learner.first_name}’s progress`);
};
