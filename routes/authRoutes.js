const express = require('express');
const authController = require('../controllers/authController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected routes
router.use(protect);
router.get('/me', authController.getMe);
router.patch('/update-password', authController.updatePassword);

// Admin only routes
router.use(restrictTo('ADMIN'));
router.get('/users', authController.getAllUsers);
router.patch('/users/:userId/confirm', authController.updateUserConfirmation);

module.exports = router; 