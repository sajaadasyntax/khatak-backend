const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { cloudinary } = require('../config/cloudinary');

/**
 * Upload a driver's license document to Cloudinary
 * @route POST /api/drivers/documents/license
 * @access Driver only
 */
exports.uploadLicenseDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'fail',
        message: 'No file uploaded'
      });
    }

    const userId = req.user.id;
    const documentUrl = req.file.path; // Cloudinary URL

    // Find existing driver profile or create one
    let driverProfile = await prisma.driver_profile.findUnique({
      where: { driverId: userId }
    });

    if (!driverProfile) {
      // Create a new driver profile if it doesn't exist
      driverProfile = await prisma.driver_profile.create({
        data: {
          id: userId,
          driverId: userId,
          licenseNumber: 'PENDING',
          licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 1 year
          vehicleMake: 'PENDING',
          vehicleModel: 'PENDING',
          vehicleYear: 'PENDING',
          vehicleColor: 'PENDING',
          licenseDocument: documentUrl,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    } else {
      // Update existing driver profile
      driverProfile = await prisma.driver_profile.update({
        where: { driverId: userId },
        data: {
          licenseDocument: documentUrl,
          updatedAt: new Date()
        }
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        documentUrl,
        message: 'License document uploaded successfully'
      }
    });
  } catch (error) {
    console.error('Error uploading license document:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload license document'
    });
  }
};

/**
 * Upload a driver's vehicle registration document to Cloudinary
 * @route POST /api/drivers/documents/registration
 * @access Driver only
 */
exports.uploadRegistrationDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'fail',
        message: 'No file uploaded'
      });
    }

    const userId = req.user.id;
    const documentUrl = req.file.path; // Cloudinary URL

    // Find existing driver profile or create one
    let driverProfile = await prisma.driver_profile.findUnique({
      where: { driverId: userId }
    });

    if (!driverProfile) {
      // Create a new driver profile if it doesn't exist
      driverProfile = await prisma.driver_profile.create({
        data: {
          id: userId,
          driverId: userId,
          licenseNumber: 'PENDING',
          licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 1 year
          vehicleMake: 'PENDING',
          vehicleModel: 'PENDING',
          vehicleYear: 'PENDING',
          vehicleColor: 'PENDING',
          registrationDocument: documentUrl,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    } else {
      // Update existing driver profile
      driverProfile = await prisma.driver_profile.update({
        where: { driverId: userId },
        data: {
          registrationDocument: documentUrl,
          updatedAt: new Date()
        }
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        documentUrl,
        message: 'Vehicle registration document uploaded successfully'
      }
    });
  } catch (error) {
    console.error('Error uploading vehicle registration document:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload vehicle registration document'
    });
  }
};

/**
 * Upload a driver's insurance document to Cloudinary
 * @route POST /api/drivers/documents/insurance
 * @access Driver only
 */
exports.uploadInsuranceDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'fail',
        message: 'No file uploaded'
      });
    }

    const userId = req.user.id;
    const documentUrl = req.file.path; // Cloudinary URL

    // Find existing driver profile or create one
    let driverProfile = await prisma.driver_profile.findUnique({
      where: { driverId: userId }
    });

    if (!driverProfile) {
      // Create a new driver profile if it doesn't exist
      driverProfile = await prisma.driver_profile.create({
        data: {
          id: userId,
          driverId: userId,
          licenseNumber: 'PENDING',
          licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 1 year
          vehicleMake: 'PENDING',
          vehicleModel: 'PENDING',
          vehicleYear: 'PENDING',
          vehicleColor: 'PENDING',
          insuranceDocument: documentUrl,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    } else {
      // Update existing driver profile
      driverProfile = await prisma.driver_profile.update({
        where: { driverId: userId },
        data: {
          insuranceDocument: documentUrl,
          updatedAt: new Date()
        }
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        documentUrl,
        message: 'Insurance document uploaded successfully'
      }
    });
  } catch (error) {
    console.error('Error uploading insurance document:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload insurance document'
    });
  }
};

/**
 * Upload a driver's background check document to Cloudinary
 * @route POST /api/drivers/documents/background-check
 * @access Driver only
 */
exports.uploadBackgroundCheckDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'fail',
        message: 'No file uploaded'
      });
    }

    const userId = req.user.id;
    const documentUrl = req.file.path; // Cloudinary URL

    // Find existing driver profile or create one
    let driverProfile = await prisma.driver_profile.findUnique({
      where: { driverId: userId }
    });

    if (!driverProfile) {
      // Create a new driver profile if it doesn't exist
      driverProfile = await prisma.driver_profile.create({
        data: {
          id: userId,
          driverId: userId,
          licenseNumber: 'PENDING',
          licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 1 year
          vehicleMake: 'PENDING',
          vehicleModel: 'PENDING',
          vehicleYear: 'PENDING',
          vehicleColor: 'PENDING',
          backgroundCheckDocument: documentUrl,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    } else {
      // Update existing driver profile
      driverProfile = await prisma.driver_profile.update({
        where: { driverId: userId },
        data: {
          backgroundCheckDocument: documentUrl,
          updatedAt: new Date()
        }
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        documentUrl,
        message: 'Background check document uploaded successfully'
      }
    });
  } catch (error) {
    console.error('Error uploading background check document:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload background check document'
    });
  }
}; 