const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Helper function to create a test driver profile
const createTestDriverProfile = async () => {
  console.log('Creating test driver profile...');
  
  try {
    // First check if we have any users with the DRIVER role
    const driver = await prisma.user.findFirst({
      where: { 
        role: 'DRIVER',
        isActive: true
      }
    });
    
    if (!driver) {
      console.log('No driver user found. Creating a test driver user first...');
      
      // Create a test driver user
      const newDriver = await prisma.user.create({
        data: {
          name: 'Test Driver',
          email: 'testdriver@example.com',
          password: '$2a$12$ZhlFf2SNQEywJH0Kg0GxIOen55ZN0Mzz44h2J1VwmdQKUDB.mTnBS', // password: password123
          phone: '123-456-7890',
          role: 'DRIVER',
          isActive: true,
          isConfirmed: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      console.log(`Created test driver user with ID: ${newDriver.id}`);
      
      // Create the driver profile
      const testProfile = await prisma.driver_profile.create({
        data: {
          id: newDriver.id,
          driverId: newDriver.id,
          licenseNumber: 'TEST-123456',
          licenseExpiry: new Date(2025, 0, 1),
          vehicleMake: 'Toyota',
          vehicleModel: 'Camry',
          vehicleYear: '2020',
          vehicleColor: 'Blue',
          vehicleRegistration: 'REG-TEST-123',
          isApproved: false,
          isRejected: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      console.log(`Created test driver profile with ID: ${testProfile.id}`);
      return testProfile;
    } else {
      console.log(`Found existing driver user with ID: ${driver.id}`);
      
      // Check if this driver already has a profile
      const existingProfile = await prisma.driver_profile.findUnique({
        where: { driverId: driver.id }
      });
      
      if (existingProfile) {
        console.log(`Driver already has profile with ID: ${existingProfile.id}`);
        return existingProfile;
      }
      
      // Create profile for the existing driver
      const testProfile = await prisma.driver_profile.create({
        data: {
          id: driver.id,
          driverId: driver.id,
          licenseNumber: 'TEST-123456',
          licenseExpiry: new Date(2025, 0, 1),
          vehicleMake: 'Toyota',
          vehicleModel: 'Camry',
          vehicleYear: '2020',
          vehicleColor: 'Blue',
          vehicleRegistration: 'REG-TEST-123',
          isApproved: false,
          isRejected: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      
      console.log(`Created test driver profile with ID: ${testProfile.id}`);
      return testProfile;
    }
  } catch (error) {
    console.error('Error in createTestDriverProfile:', error);
    throw error; // Rethrow to be caught by the calling function
  }
};

// Add any new driver-specific controller functions here 