const { PrismaClient, Role } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  // Hash the password
  const hashedPassword = await bcrypt.hash('admin123', 10)

  // Create admin user
  const admin = await prisma.users.create({
    data: {
      name: 'Admin User',
      email: 'admin@example.com',
      password: hashedPassword,
      phone: '+1234567890',
      role: Role.ADMIN,
      address: {
        street: '123 Admin Street',
        city: 'Admin City',
        state: 'Admin State',
        country: 'Admin Country',
        zipCode: '12345'
      }
    }
  })

  console.log('Admin user created:', admin)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 