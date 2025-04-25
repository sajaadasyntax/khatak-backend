const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');
  
  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  
  const admin = await prisma.User.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@example.com',
      password: adminPassword,
      role: 'ADMIN',
      isConfirmed: true
    },
  });

  console.log({ admin });
  
  // Create client user
  const clientPassword = await bcrypt.hash('client123', 12);
  const client = await prisma.User.upsert({
    where: { email: 'client@example.com' },
    update: {},
    create: {
      name: 'Client User',
      email: 'client@example.com',
      password: clientPassword,
      phone: '123-456-7891',
      role: 'CLIENT',
      isConfirmed: true
    }
  });
  console.log('Created client user');
  
  // Create driver user
  const driverPassword = await bcrypt.hash('driver123', 12);
  const driver = await prisma.User.upsert({
    where: { email: 'driver@example.com' },
    update: {},
    create: {
      name: 'Driver User',
      email: 'driver@example.com',
      password: driverPassword,
      phone: '123-456-7892',
      role: 'DRIVER',
      isConfirmed: false
    }
  });
  console.log('Created driver user');
  
  // Create sample order
  const order = await prisma.Order.create({
    data: {
      trackingNumber: 'SHP' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000),
      clientId: client.id,
      driverId: driver.id,
      pickupAddress: {
        street: '123 Pickup St',
        city: 'Pickup City',
        state: 'Pickup State',
        zipCode: '12348',
        country: 'USA'
      },
      deliveryAddress: {
        street: '123 Delivery St',
        city: 'Delivery City',
        state: 'Delivery State',
        zipCode: '12349',
        country: 'USA'
      },
      packageDetails: {
        weight: 10,
        dimensions: {
          length: 20,
          width: 15,
          height: 10
        },
        description: 'Sample package',
        fragile: false
      },
      status: 'IN_TRANSIT',
      price: 45.99,
      paymentStatus: 'PAID',
      estimatedDeliveryTime: new Date(Date.now() + 86400000), // 1 day from now
    }
  });
  console.log('Created sample order');
  
  console.log('Seeding finished!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 