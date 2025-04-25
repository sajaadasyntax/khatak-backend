const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    const adminData = {
      name: 'Admin User',
      email: 'admin@example.com',
      password: await bcrypt.hash('admin123', 12),
      role: 'ADMIN',
      isActive: true,
      isConfirmed: true,
      phone: '1234567890'
    };

    const admin = await prisma.user.create({
      data: adminData
    });

    console.log('Admin user created successfully:', {
      id: admin.id,
      email: admin.email,
      role: admin.role
    });
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser(); 