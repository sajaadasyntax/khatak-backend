const prisma = require('./lib/prisma');
const bcrypt = require('bcryptjs');

async function updateAdminPassword() {
  try {
    console.log('Generating hashed password...');
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    console.log('Looking for admin user...');
    const admin = await prisma.user.findFirst({ 
      where: { 
        role: 'ADMIN' 
      } 
    });
    
    if (admin) {
      console.log('Found admin user:', admin.email);
      
      const updated = await prisma.user.update({ 
        where: { 
          id: admin.id 
        }, 
        data: { 
          password: hashedPassword 
        } 
      });
      
      console.log('Admin password updated for:', updated.email);
      console.log('New password is: admin123');
    } else {
      console.log('No admin user found. Creating one...');
      
      const newAdmin = await prisma.user.create({ 
        data: { 
          name: 'Admin User', 
          email: 'admin@example.com', 
          password: hashedPassword, 
          phone: '0000000000', 
          role: 'ADMIN' 
        } 
      });
      
      console.log('Created new admin user:', newAdmin.email);
      console.log('Password is: admin123');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
    console.log('Database connection closed.');
  }
}

updateAdminPassword(); 