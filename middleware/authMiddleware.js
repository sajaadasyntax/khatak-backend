const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Protect routes
exports.protect = async (req, res, next) => {
  try {
    let token;

    // 1) Get token and check if it exists
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      console.log('Token received:', token ? `${token.substring(0, 15)}...` : 'none');
    } else {
      console.log('No Authorization header or not Bearer format');
    }

    if (!token) {
      return res.status(401).json({
        status: 'fail',
        message: 'Not authorized. No token provided.'
      });
    }

    // 2) Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token decoded successfully:', decoded.id, decoded.role);
      
      // 3) Check if user still exists
      const currentUser = await prisma.user.findUnique({
        where: { id: decoded.id }
      });

      if (!currentUser) {
        console.log('User not found for token:', decoded.id);
        return res.status(401).json({
          status: 'fail',
          message: 'The user belonging to this token no longer exists.'
        });
      }

      // GRANT ACCESS TO PROTECTED ROUTE
      req.user = currentUser;
      next();
    } catch (verifyError) {
      console.error('Token verification failed:', verifyError.message);
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid token. Authentication failed.'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      status: 'fail',
      message: 'Not authorized'
    });
  }
};

// Restrict to certain roles
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to perform this action'
      });
    }
    next();
  };
}; 