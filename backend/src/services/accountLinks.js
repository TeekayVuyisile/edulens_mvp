import crypto from 'crypto';
import pool from '../config/database.js';
import User from '../models/User.js';
import emailService from './emailService.js';

// Invitations and admin-issued reset links reuse the password reset columns
// (token stored as a SHA-256 hash), so the existing /reset-password flow
// accepts them. They differ only in lifetime and wording.
const LINKS = {
  invite: { ttl: '7 days', expiresIn: '7 days' },
  reset: { ttl: '24 hours', expiresIn: '24 hours' },
};

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  school_admin: 'School Admin',
  teacher: 'Teacher',
};

const frontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

/** A password nobody knows, for accounts that are set up through an invitation. */
export const unusablePassword = () => crypto.randomBytes(32).toString('hex');

/**
 * Issues a single-use link for `user` to choose a password and emails it when
 * email is configured. The link is also returned so an admin can share it
 * another way (many schools coordinate over WhatsApp).
 *
 * @param {{ user_id: string, email: string, first_name: string, role: string }} user
 * @param {{ kind: 'invite' | 'reset', schoolName?: string }} options
 * @returns {Promise<{ link: string, emailSent: boolean, expiresIn: string }>}
 */
export const issueAccountLink = async (user, { kind, schoolName } = {}) => {
  const { ttl, expiresIn } = LINKS[kind];
  const token = crypto.randomBytes(32).toString('hex');

  await pool.query(
    `UPDATE users
     SET password_reset_token = $1, password_reset_expires = CURRENT_TIMESTAMP + $2::interval
     WHERE user_id = $3`,
    [User.hashResetToken(token), ttl, user.user_id]
  );

  const link = `${frontendUrl()}/reset-password?token=${token}${kind === 'invite' ? '&invite=1' : ''}`;

  let emailSent = false;
  if (emailService.enabled) {
    try {
      await emailService.sendAccountLinkEmail({
        email: user.email,
        firstName: user.first_name,
        link,
        kind,
        roleLabel: ROLE_LABELS[user.role] ?? user.role,
        schoolName,
      });
      emailSent = true;
    } catch (error) {
      console.error(`Failed to email ${kind} link:`, error.message);
    }
  }

  return { link, emailSent, expiresIn };
};
