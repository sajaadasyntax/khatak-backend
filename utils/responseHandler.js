/**
 * Standardized API response handler
 */

// Success response
exports.success = (res, data = null, message = 'Operation successful', statusCode = 200) => {
  return res.status(statusCode).json({
    status: 'success',
    message,
    data
  });
};

// Error response
exports.error = (res, message = 'An error occurred', statusCode = 400, details = null) => {
  const response = {
    status: 'error',
    message
  };

  // Include error details in development mode
  if (process.env.NODE_ENV !== 'production' && details) {
    response.details = details;
  }

  return res.status(statusCode).json(response);
};

// Not found response
exports.notFound = (res, message = 'Resource not found') => {
  return exports.error(res, message, 404);
};

// Unauthorized response
exports.unauthorized = (res, message = 'Unauthorized access') => {
  return exports.error(res, message, 401);
};

// Forbidden response
exports.forbidden = (res, message = 'Access forbidden') => {
  return exports.error(res, message, 403);
};

// Validation error response
exports.validationError = (res, errors) => {
  return exports.error(res, 'Validation error', 422, errors);
};

// Server error response
exports.serverError = (res, error) => {
  console.error('Server Error:', error);
  
  return exports.error(
    res,
    'Internal server error',
    500,
    process.env.NODE_ENV !== 'production' ? error.stack : null
  );
}; 