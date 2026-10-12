import crypto from 'crypto';
import User from '../models/User.js';
import emailService from '../services/emailService.js';

// Roles that may sign in.
// Learners never sign in; their parents and guardians use the parent portal.
const SIGN_IN_ROLES = ['super_admin', 'school_admin', 'teacher', 'parent'];

const RESET_REQUESTED_MESSAGE =
  'If an account exists with this email, you will receive a password reset link';

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);

    // Same response for unknown email and wrong password, so the endpoint
    // can't be used to discover which emails have accounts.
    if (!user || !(await User.comparePassword(password, user.password_hash))) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }

    if (!SIGN_IN_ROLES.includes(user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'This account cannot sign in'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        status: 'error',
        message: 'Account is deactivated. Please contact your administrator.'
      });
    }

    await User.updateLastLogin(user.user_id);

    const token = User.generateToken(user);
    const { password_hash: _passwordHash, ...userWithoutPassword } = user;

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Login failed'
    });
  }
};

// @desc    Request a password reset email
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findByEmail(email);

    if (user && user.is_active && SIGN_IN_ROLES.includes(user.role)) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      await User.setPasswordResetToken(user.user_id, resetToken);

      try {
        await emailService.sendPasswordResetEmail(user.email, resetToken);
      } catch (emailError) {
        // Logged, not returned: the response must look the same either way.
        console.error('Password reset email failed:', emailError);
      }
    }

    res.status(200).json({
      status: 'success',
      message: RESET_REQUESTED_MESSAGE
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process password reset request'
    });
  }
};

// @desc    Reset password with the emailed token
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const user = await User.resetPassword(token, password);

    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired reset token'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reset password'
    });
  }
};

// @desc    Get the signed-in user's profile
// @route   GET /api/auth/profile
// @access  Private
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: { user }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get profile'
    });
  }
};

// @desc    Update the signed-in user's name and phone
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const { first_name, last_name, phone } = req.body;

    const updateData = {};
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (phone !== undefined) updateData.phone = phone || null;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No fields to update'
      });
    }

    const user = await User.update(req.user.userId, updateData);

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update profile'
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
// Tokens are stateless; the client discards its token. This endpoint exists so
// the client has a single place to call (and for the activity log).
export const logout = (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully'
  });
};
