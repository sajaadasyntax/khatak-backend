const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authController = require('../controllers/authController');

// Routes need to be protected - only authenticated users can access their notifications
router.use(authController.protect);

// Get user notifications
router.get('/', notificationController.getUserNotifications);

// Mark notifications as read
router.post('/mark-read', notificationController.markNotificationsAsRead);

module.exports = router; 