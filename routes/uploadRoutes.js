const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { uploadDriverDocuments } = require('../config/cloudinary');

// Specific routes for each document type
router.post(
  '/temp-document',
  (req, res, next) => {
    // Detect which document type is being uploaded based on the form field name
    const fieldName = Object.keys(req.body).find(
      key => ['licenseDocument', 'registrationDocument', 'backgroundCheckDocument', 'insuranceDocument'].includes(key)
    ) || 'document';
    
    // Use the detected field name for multer
    uploadDriverDocuments.single(fieldName)(req, res, next);
  },
  uploadController.uploadTempDocument
);

// Handle specific document types
router.post(
  '/license',
  uploadDriverDocuments.single('licenseDocument'),
  uploadController.uploadTempDocument
);

router.post(
  '/registration',
  uploadDriverDocuments.single('registrationDocument'),
  uploadController.uploadTempDocument
);

router.post(
  '/driver-photo',
  uploadDriverDocuments.single('backgroundCheckDocument'),
  uploadController.uploadTempDocument
);

router.post(
  '/insurance',
  uploadDriverDocuments.single('insuranceDocument'),
  uploadController.uploadTempDocument
);

module.exports = router; 