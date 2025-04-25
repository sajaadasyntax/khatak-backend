const express = require('express');
const orderController = require('../controllers/orderController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);

// Client-specific routes with prefix parameters
router.get('/client/:clientId/current', orderController.getCurrentOrders);

// Driver-specific routes with prefix parameters
router.get('/driver/:driverId/current', orderController.getCurrentOrdersForDriver);

// Admin-specific routes
router.get('/admin/:adminId/current', authController.restrictTo('admin'), orderController.getAdminCurrentOrders);

// Dashboard data route
router.get('/:role/:userId/dashboard', orderController.getDashboardData);

// Routes for all authenticated users
router.get('/:id', orderController.getOrder);
router.put('/:id', orderController.updateOrder);

// Routes for clients
router.post('/', orderController.createOrder);

// Routes for order cancellation (clients, drivers, and admins)
router.patch(
  '/:id/cancel',
  authController.restrictTo('client', 'driver', 'admin'),
  orderController.cancelOrder
);

// Routes for drivers
router.patch(
  '/:id/accept',
  authController.restrictTo('driver'),
  orderController.acceptOrder
);
router.patch(
  '/:id/status',
  authController.restrictTo('driver', 'admin'),
  orderController.updateOrderStatus
);

// Routes for all users with proper filtering
router.get('/', orderController.getAllOrders);

module.exports = router; 