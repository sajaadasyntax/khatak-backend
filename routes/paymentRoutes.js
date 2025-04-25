const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authController = require('../controllers/authController');

// Protect all routes
router.use(authController.protect);

// Bank account management (admin only)
router.route('/bank-accounts')
  .get(paymentController.getBankAccounts)
  .post(paymentController.addBankAccount);

router.route('/bank-accounts/:id')
  .put(paymentController.updateBankAccount)
  .delete(paymentController.deleteBankAccount);

// Driver-specific payment confirmation routes
router.put('/driver-confirm/:paymentId', paymentController.driverConfirmPayment);
router.get('/driver-pending', paymentController.getDriverPendingPayments);
router.post('/driver-report/:paymentId', paymentController.driverReportIssue);

// Regular payment routes
router.post('/submit/:orderId', paymentController.submitPayment);
router.put('/confirm/:paymentId', paymentController.confirmPayment);

// Payment history
router.get('/', paymentController.getPayments);

module.exports = router; 