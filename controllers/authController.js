const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

const standardizePhoneNumber = (phone) => {
  if (!phone) return '';
  
  // Remove any non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If it's a Saudi number with country code (966)
  if (cleaned.startsWith('966') && cleaned.length === 12) {
    return '+966' + cleaned.substring(3);
  }
  
  // If it's a Saudi number without country code (starts with 05)
  if (cleaned.startsWith('05') && cleaned.length === 10) {
    return '+966' + cleaned.substring(1);
  }
  
  // If it's a Saudi number without country code (starts with 5)
  if (cleaned.startsWith('5') && cleaned.length === 9) {
    return '+966' + cleaned;
  }
  
  // Return as is if it doesn't match any pattern
  return cleaned;
};

const signToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

exports.register = async (req, res) => {
  try {
    const { 
      name, 
      password, 
      phone, 
      role = 'CLIENT',
      // Driver-specific fields
      licenseDocumentUrl,
      registrationDocumentUrl,
      driverPhotoUrl,
      insuranceDocumentUrl,
      tempRegistrationId,
      // Vehicle info
      plateNumber,
      carMake,
      carModel,
      carYear,
      carColor
    } = req.body;

    // Standardize phone number
    const standardizedPhone = standardizePhoneNumber(phone);

    if (!standardizedPhone) {
      return res.status(400).json({
        status: 'fail',
        message: 'Valid phone number is required'
      });
    }

    // Check if user already exists by phone
    const existingUser = await prisma.user.findFirst({
      where: {
        phone: standardizedPhone
      }
    });

    if (existingUser) {
      return res.status(400).json({
        status: 'fail',
        message: 'Phone number already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with role-specific settings
    const userData = {
      name: name || standardizedPhone, // Use phone as fallback name
      email: `${standardizedPhone.replace('+', '')}@temp.khatak.com`, // Generate placeholder email from phone
      phone: standardizedPhone,
      password: hashedPassword,
      role,
      isConfirmed: role === 'CLIENT' ? true : false // Only confirm client accounts automatically
    };

    // Handle driver registration
    if (role === 'DRIVER') {
      // Check if document URLs are provided - insurance is now optional
      if (!licenseDocumentUrl || !registrationDocumentUrl || !driverPhotoUrl) {
        return res.status(400).json({
          status: 'fail',
          message: 'Required documents are missing for driver registration'
        });
      }

      // Create user and driver profile in a transaction
      const result = await prisma.$transaction(async (prisma) => {
        // Create user
        const user = await prisma.user.create({
          data: userData,
          select: {
            id: true,
            name: true,
            phone: true,
            role: true,
            isConfirmed: true
          }
        });

        // Create driver profile with document URLs
        const driverProfile = await prisma.driver_profile.create({
          data: {
            id: user.id,
            driverId: user.id,
            licenseNumber: plateNumber || 'PENDING',
            licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 1 year
            vehicleMake: carMake || 'PENDING',
            vehicleModel: carModel || 'PENDING',
            vehicleYear: String(carYear) || 'PENDING', // Convert to string explicitly
            vehicleColor: carColor || 'PENDING',
            vehicleRegistration: plateNumber || 'PENDING',
            licenseDocument: licenseDocumentUrl,
            registrationDocument: registrationDocumentUrl,
            backgroundCheckDocument: driverPhotoUrl,
            insuranceDocument: insuranceDocumentUrl || null,
            isApproved: false,
            isRejected: false,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });

        return user;
      });

      // Return response in the expected format
      return res.status(201).json({
        status: 'success',
        message: 'Registration successful. Your account is pending approval.',
        data: {
          user: result
        }
      });
    } else {
      // Regular user creation (non-driver)
      const user = await prisma.user.create({
        data: userData,
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
          isConfirmed: true
        }
      });

      // Create token for client accounts
      const token = signToken(user.id, user.role);

      // Return response in the expected format with token
      return res.status(201).json({
        status: 'success',
        message: 'Registration successful. You can now login.',
        data: {
          token,
          user
        }
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    // Standardize phone number
    const standardizedPhone = standardizePhoneNumber(phone);

    if (!standardizedPhone) {
      return res.status(400).json({
        status: 'fail',
        message: 'Valid phone number is required'
      });
    }

    // Check if password exists
    if (!password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Password is required'
      });
    }

    // Find user by phone
    const user = await prisma.user.findFirst({
      where: {
        phone: standardizedPhone
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        password: true,
        role: true,
        isConfirmed: true,
        isActive: true
      }
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        status: 'fail',
        message: 'Incorrect phone number or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        status: 'fail',
        message: 'Your account has been deactivated'
      });
    }

    // Check if user is confirmed
    if (!user.isConfirmed) {
      return res.status(401).json({
        status: 'fail',
        message: 'Your account is pending confirmation'
      });
    }

    // Create token
    const token = signToken(user.id, user.role);

    // Remove password from output
    delete user.password;

    res.status(200).json({
      status: 'success',
      data: {
        token,
        user
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'An error occurred during login'
    });
  }
};

exports.getUserProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isConfirmed: true
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
};

// Alias for getUserProfile to match route expectations
exports.getMe = exports.getUserProfile;

exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user from collection
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    // Check if POSTed current password is correct
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({
        status: 'fail',
        message: 'Your current password is wrong'
      });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    });

    res.status(200).json({
      status: 'success',
      message: 'Password updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
};

// Admin functions - these might be missing from the routes but adding them for completeness
exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isConfirmed: true,
        isActive: true,
        createdAt: true
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        users
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
};

exports.updateUserConfirmation = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isConfirmed } = req.body;

    const user = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { isConfirmed },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isConfirmed: true
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
}; 