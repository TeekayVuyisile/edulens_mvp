import jwt from 'jsonwebtoken';

export const protect = (roles = []) => {
  return async (req, res, next) => {
    try {
      // Get token from header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          status: 'error',
          message: 'No token provided'
        });
      }

      const token = authHeader.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user to request
      req.user = decoded;

      // Check if user has required role
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