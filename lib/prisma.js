const { PrismaClient } = require('@prisma/client');

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
const globalForPrisma = global;

let prisma;

try {
  // Initialize PrismaClient
  prisma = new PrismaClient({
    log: ['query', 'error', 'warn'],
  });
  
  console.log('Prisma client initialized successfully');
} catch (error) {
  console.error('Error initializing Prisma client:', error);
  throw error;
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

module.exports = prisma; 