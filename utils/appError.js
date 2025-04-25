/**
 * Custom error class for operational errors that can be sent to clients
 */
class AppError extends Error {
  /**
   * Creates a new AppError
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code for the error
   */
  constructor(message, statusCode) {
    super(message);
    
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError; 