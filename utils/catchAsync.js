/**
 * Wrapper function for async route handlers to eliminate try/catch blocks
 * Automatically passes errors to the error handling middleware
 * 
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware function that handles errors
 */
module.exports = fn => {
  return (req, res, next) => {
    fn(req, res, next).catch(err => {
      console.error('Caught async error:', err.message);
      console.error('Error stack:', err.stack);
      next(err);
    });
  };
}; 