const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const AppError = require('../utils/appError');

/**
 * Middleware to protect routes - checks for valid authentication token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {Promise<void>}
 */
exports.protect = async (req, res, next) => {
  try {
    console.log('Auth protect middleware - Checking authentication');
    
    // 1) Get token from headers
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    console.log('Token present:', !!token);
    
    // Check if token exists
    if (!token) {
      if (process.env.NODE_ENV === 'development') {
        // Provide a mock admin user in development mode
        console.log('Development mode: Providing mock admin user');
        req.user = {
          id: 'dev-admin-id',
          name: 'Dev Admin',
          email: 'admin@dev.com',
          role: 'ADMIN'
        };
        return next();
      }
      
      console.error('No authorization token provided');
      return res.status(401).json({
        status: 'fail',
        message: 'You are not logged in. Please log in to access this resource.'
      });
    }
    
    // 2) Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token decoded successfully for user:', decoded.id);
      
      // 3) Check if user still exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.id }
      });
      
      if (!user) {
        console.error('User from token no longer exists in database');
        return res.status(401).json({
          status: 'fail',
          message: 'The user belonging to this token no longer exists.'
        });
      }
      
      // 4) Attach user to request
      req.user = user;
      console.log(`User authenticated: ${user.id}, role: ${user.role}`);
      next();
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError.message);
      
      if (process.env.NODE_ENV === 'development') {
        // Provide a mock admin user in development mode
        console.log('Development mode: Providing mock admin user after JWT error');
        req.user = {
          id: 'dev-admin-id',
          name: 'Dev Admin',
          email: 'admin@dev.com',
          role: 'ADMIN'
        };
        return next();
      }
      
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid token. Please log in again.'
      });
    }
  } catch (error) {
    console.error('Error in auth protect middleware:', error);
    
    if (process.env.NODE_ENV === 'development') {
      // Provide a mock admin user in development mode
      console.log('Development mode: Providing mock admin user after error');
      req.user = {
        id: 'dev-admin-id',
        name: 'Dev Admin',
        email: 'admin@dev.com',
        role: 'ADMIN'
      };
      return next();
    }
    
    return res.status(500).json({
      status: 'error',
      message: 'Authentication error. Please try again.'
    });
  }
};

/**
 * Middleware to check if user is an admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {void}
 */
exports.isAdmin = (req, res, next) => {
  // Log authentication information for debugging
  console.log('isAdmin middleware - Checking admin status');
  
  if (!req.user) {
    console.error('isAdmin middleware - No user found in request. Authentication issue.');
    if (process.env.NODE_ENV === 'development') {
      // Bypass authentication in development mode
      console.log('Development mode: Bypassing admin check');
      return next();
    }
    return res.status(401).json({
      status: 'fail',
      message: 'Authentication required'
    });
  }
  
  console.log(`isAdmin middleware - User role: ${req.user.role}`);
  
  if (req.user.role !== 'ADMIN') {
    if (process.env.NODE_ENV === 'development') {
      // Bypass admin check in development mode
      console.log('Development mode: Bypassing admin check for user with role:', req.user.role);
      return next();
    }
    
    console.error(`isAdmin middleware - Access denied for user ${req.user.id} with role ${req.user.role}`);
    return res.status(403).json({
      status: 'fail',
      message: 'Access denied. Admin privileges required'
    });
  }
  
  console.log('isAdmin middleware - Admin access granted');
  next();
}; 