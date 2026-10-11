import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

export const protect = (roles = []) => {
  return async (req, res, next) => {
    try {
      // 1. Get token from header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          status: 'error',
          message: 'No token provided'
        });
      }

      const token = authHeader.split(' ')[1];

      // 2. Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 3. Verify user and school status in Database
      // This is a security layer to catch deactivated accounts immediately
      const statusQuery = `
        SELECT u.is_active as user_active, s.is_active as school_active, u.role
        FROM users u
        LEFT JOIN schools s ON u.school_id = s.school_id
        WHERE u.user_id = $1
      `;
      
      const statusResult = await pool.query(statusQuery, [decoded.userId]);
      
      if (statusResult.rows.length === 0) {
        return res.status(401).json({
          status: 'error',
          message: 'User no longer exists'
        });
      }
      
      const { user_active, school_active, role } = statusResult.rows[0];
      
      if (!user_active) {
        return res.status(401).json({
          status: 'error',
          message: 'Account has been deactivated'
        });
      }
      
      // If user belongs to a school, school must be active
      // Super admins don't have a school_id in this context usually
      if (role !== 'super_admin' && school_active === false) {
        return res.status(401).json({
          status: 'error',
          message: 'Your school access has been suspended'
        });
      }

      // 4. Attach user to request
      req.user = decoded;

      // 5. Check if user has required role
      if (roles.length > 0 && !roles.includes(decoded.role)) {
        return res.status(403).json({
          status: 'error',
          message: 'Not authorized to access this resource'
        });
      }

      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid token'
        });
      }

      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          status: 'error',
          message: 'Token expired'
        });
      }

      console.error('Auth middleware error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Authentication failed'
      });
    }
  };
};

export const requireSuperAdmin = protect(['super_admin']);
export const requireSchoolAdmin = protect(['school_admin']);
export const requireTeacher = protect(['teacher']);
export const requireAdminOrTeacher = protect(['school_admin', 'teacher']);