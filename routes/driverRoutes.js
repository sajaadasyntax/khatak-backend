const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const driverDocumentsController = require('../controllers/driverDocumentsController');
const authController = require('../controllers/authController');
const { isAdmin } = require('../middleware/auth');
const { uploadDriverDocuments } = require('../config/cloudinary');

// Protect all routes - require authentication
router.use(authController.protect);

// Driver document upload routes
router.post(
  '/documents/license',
  uploadDriverDocuments.single('licenseDocument'),
  driverDocumentsController.uploadLicenseDocument
);

// Compatibility route for frontend using old URL pattern
router.post(
  '/upload/license',
  uploadDriverDocuments.single('licenseDocument'),
  driverDocumentsController.uploadLicenseDocument
);

router.post(
  '/documents/registration',
  uploadDriverDocuments.single('registrationDocument'),
  driverDocumentsController.uploadRegistrationDocument
);

router.post(
  '/documents/insurance',
  uploadDriverDocuments.single('insuranceDocument'),
  driverDocumentsController.uploadInsuranceDocument
);

router.post(
  '/documents/background-check',
  uploadDriverDocuments.single('backgroundCheckDocument'),
  driverDocumentsController.uploadBackgroundCheckDocument
);

// Driver-specific routes (not admin-only)
// Add your other driver-specific routes here

module.exports = router; 