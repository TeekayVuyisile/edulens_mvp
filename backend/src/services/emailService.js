import nodemailer from 'nodemailer';

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  /** True when SMTP settings are present. Tests and fresh installs run without email. */
  get enabled() {
    return Boolean(process.env.SMTP_HOST);
  }

  /** Every email goes through here, so nothing is sent unless SMTP is configured. */
  async send(mailOptions) {
    if (!this.enabled) {
      throw new Error('Email is not configured (SMTP_HOST is empty)');
    }
    return this.transporter.sendMail(mailOptions);
  }

  /**
   * Invitation or admin-issued reset link.
   * kind: 'invite' (new account, 7 days) or 'reset' (existing account, 24 hours)
   */
  async sendAccountLinkEmail({ email, firstName, link, kind, roleLabel, schoolName }) {
    const isInvite = kind === 'invite';
    const heading = isInvite ? 'You’re invited to Edulens LMS' : 'Reset your Edulens password';
    const intro = isInvite
      ? `You’ve been added to Edulens LMS as <strong>${roleLabel}</strong>${schoolName ? ` at <strong>${schoolName}</strong>` : ''}. Choose a password to activate your account.`
      : 'An administrator sent you a link to choose a new password.';

    return this.send({
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: isInvite ? 'Your Edulens LMS invitation' : 'Reset your Edulens LMS password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">${heading}</h2>
          <p>Hi ${firstName},</p>
          <p>${intro}</p>
          <a href="${link}"
             style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">
            ${isInvite ? 'Set up my account' : 'Choose a new password'}
          </a>
          <p>This link expires in ${isInvite ? '7 days' : '24 hours'}.</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">Edulens LMS - Empowering Teachers, Inspiring Learners</p>
        </div>
      `
    });
  }

  async sendPasswordResetEmail(email, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: 'Password Reset Request - Edulens LMS',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Password Reset Request</h2>
          <p>You have requested to reset your password for Edulens LMS.</p>
          <p>Click the link below to reset your password:</p>
          <a href="${resetUrl}" 
             style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">
            Reset Password
          </a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            Edulens LMS - Empowering Teachers, Inspiring Learners
          </p>
        </div>
      `
    };

    try {
      await this.send(mailOptions);
      return true;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  }

async sendPasswordChangedNotification(email, firstName, lastName, superAdminContact) {
  const mailOptions = {
    from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
    to: email,
    subject: 'Password Changed - Edulens LMS',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Password Changed Notification</h2>
        <p>Dear ${firstName} ${lastName},</p>
        <p>Your Edulens LMS account password has been changed by the system administrator.</p>
        <p>If you did not request this change or have any concerns, please contact:</p>
        
        <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #4F46E5; margin: 20px 0;">
          <h4 style="color: #4F46E5; margin-top: 0;">Contact Information:</h4>
          <p><strong>Super Admin Email:</strong> ${superAdminContact.email}</p>
          <p><strong>Super Admin Phone:</strong> ${superAdminContact.phone}</p>
          <p><strong>Contact Hours:</strong> ${superAdminContact.hours || 'Monday - Friday, 8:00 AM - 5:00 PM'}</p>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          For security reasons, please ensure you keep your password confidential and report any suspicious activity.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          Edulens LMS - Empowering Teachers, Inspiring Learners
        </p>
      </div>
    `
  };

  try {
    await this.send(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending password change notification:', error);
    throw error;
  }
}

// passwordInfo is optional, e.g. a note about a temporary password
async sendWelcomeEmail(email, firstName, role, passwordInfo) {
  const mailOptions = {
    from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
    to: email,
    subject: 'Welcome to Edulens LMS!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Welcome to Edulens LMS!</h2>
        <p>Dear ${firstName},</p>
        <p>Your account has been created successfully as a <strong>${role.replace('_', ' ')}</strong>.</p>
        ${passwordInfo ? `<p>${passwordInfo}</p>` : ''}
        <p>You can now login to the system using your email address.</p>
        <p>If you have any questions, please contact your school administrator or the system support team.</p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          Edulens LMS - Empowering Teachers, Inspiring Learners
        </p>
      </div>
    `
  };

  try {
    await this.send(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    // Don't throw error for welcome email failures
  }
}
}

export default new EmailService();