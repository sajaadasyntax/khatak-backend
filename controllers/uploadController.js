const { cloudinary } = require('../config/cloudinary');

/**
 * Upload a temporary document to Cloudinary before registration
 * @route POST /api/uploads/temp-document
 * @access Public
 */
exports.uploadTempDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'fail',
        message: 'No file uploaded'
      });
    }

    // Get the temporary ID from the request
    const tempId = req.body.tempId || `temp-${Date.now()}`;
    
    // The file has already been uploaded to Cloudinary by multer-storage-cloudinary
    const documentUrl = req.file.path;
    
    // Get document type (from the field name used during upload)
    const documentType = req.file.fieldname;

    // Return the URL and document info
    res.status(200).json({
      status: 'success',
      documentUrl,
      documentType,
      tempId,
      message: 'Document uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading temporary document:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload document'
    });
  }
}; 