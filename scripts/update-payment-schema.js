// Script to update the Payment schema with new fields
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updatePaymentSchema() {
  try {
    console.log('Starting Payment schema update...');
    
    // Check if the columns already exist to avoid errors
    const existingColumns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Payment' 
      AND (column_name = 'driverConfirmed' OR column_name = 'hasIssue' OR column_name = 'issueDetails')
    `;
    
    const columnsToAdd = [];
    const columnNames = existingColumns.map(col => col.column_name);
    
    if (!columnNames.includes('driverConfirmed')) {
      columnsToAdd.push(`ALTER TABLE "Payment" ADD COLUMN "driverConfirmed" BOOLEAN DEFAULT false`);
    }
    
    if (!columnNames.includes('hasIssue')) {
      columnsToAdd.push(`ALTER TABLE "Payment" ADD COLUMN "hasIssue" BOOLEAN DEFAULT false`);
    }
    
    if (!columnNames.includes('issueDetails')) {
      columnsToAdd.push(`ALTER TABLE "Payment" ADD COLUMN "issueDetails" TEXT`);
    }
    
    // Execute migrations if needed
    if (columnsToAdd.length > 0) {
      for (const sqlStatement of columnsToAdd) {
        console.log(`Executing: ${sqlStatement}`);
        await prisma.$executeRawUnsafe(sqlStatement);
      }
      console.log('Payment schema updated successfully!');
    } else {
      console.log('Payment schema is already up to date!');
    }
    
  } catch (error) {
    console.error('Error updating Payment schema:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updatePaymentSchema(); 