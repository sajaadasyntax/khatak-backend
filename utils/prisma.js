const { PrismaClient } = require('@prisma/client');

// Initialize Prisma with error handling
let prisma;

try {
  prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });
  
  console.log('Prisma client initialized successfully');
} catch (error) {
  console.error('Failed to initialize Prisma:', error);
  process.exit(1);
}

module.exports = prisma; 