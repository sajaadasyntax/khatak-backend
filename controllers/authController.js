const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

const signToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

exports.register = async (req, res) => {
  try {
    const { 
      name, 
      email, 
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

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        status: 'fail',
        message: 'Email already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with role-specific settings
    const userData = {
      name,
      email,
      password: hashedPassword,
      phone,
      role,
      isConfirmed: false // All users need confirmation before login
    };

    // Create user and driver profile in a transaction if this is a driver
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
            email: true,
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

      // Don't generate token for unconfirmed users
      res.status(201).json({
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
          email: true,
          role: true,
          isConfirmed: true
        }
      });

      // Don't generate token for unconfirmed users
      res.status(201).json({
        status: 'success',
        message: 'Registration successful. Your account is pending approval.',
        data: {
          user
        }
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;

    // Check if emailOrPhone and password exist
    if (!emailOrPhone || !password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide email/phone and password'
      });
    }

    // Check if user exists with either email or phone
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: emailOrPhone },
          { phone: emailOrPhone }
        ]
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
        message: 'Incorrect email/phone or password'
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

exports.getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
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

exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isConfirmed: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      status: 'success',
      results: users.length,
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
      where: { id: userId },
      data: { isConfirmed },
      select: {
        id: true,
        name: true,
        email: true,
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

exports.protect = async (req, res, next) => {
  try {
    // Get token
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'fail',
        message: 'You are not logged in. Please log in to get access.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user) {
      return res.status(401).json({
        status: 'fail',
        message: 'The user belonging to this token no longer exists.'
      });
    }

    // Grant access to protected route
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth protection error:', error);
    res.status(401).json({
      status: 'fail',
      message: 'Not authorized'
    });
  }
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // Make case-insensitive comparison
    const userRole = req.user.role.toLowerCase();
    const allowedRoles = roles.map(role => role.toLowerCase());
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to perform this action'
      });
    }
    next();
  };
}; 