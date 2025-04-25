const express = require('express');
const adminController = require('../controllers/adminController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect and restrict all routes to admin only
router.use(authController.protect);
router.use(authController.restrictTo('ADMIN'));

// Dashboard data
router.get('/dashboard', adminController.getDashboardData);

// Users management
router.get('/users', adminController.getUsers);
router.patch('/users/:userId/status', adminController.updateUserStatus);
router.post('/users/reset-password', adminController.resetUserPassword);

// Driver management
router.get('/drivers/:id/profile', adminController.getDriverProfile);

// Pending drivers management
router.get('/drivers/pending', adminController.getPendingDrivers);
router.post('/drivers/:driverId/approve', adminController.approveDriver);
router.post('/drivers/:driverId/reject', adminController.rejectDriver);

// Orders management
router.get('/orders', adminController.getOrders);
router.patch('/orders/:orderId/status', adminController.updateOrder);
router.get('/orders/:orderId', adminController.getOrder);
router.put('/orders/:orderId/assign-driver', adminController.assignDriverToOrder);

// Driver approval routes
router.get('/driver-approvals', adminController.getDriverApplications);
router.get('/driver-approvals/:id', adminController.getDriverApplication);
router.post('/driver-approvals/:id/approve', adminController.approveDriverApplication);
router.post('/driver-approvals/:id/reject', adminController.rejectDriverApplication);

module.exports = router; 