const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);

// Admin-only routes
router.use(authController.restrictTo('admin'));

// These routes will be implemented when we create the user controller
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'This route is not yet implemented',
  });
});

module.exports = router; 