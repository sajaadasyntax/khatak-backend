/**
 * Deployment helper script
 * Prepares the application for deployment
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Define colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

// Helper to log with color
const log = (message, color = colors.reset) => {
  console.log(`${color}${message}${colors.reset}`);
};

// Helper to run commands and handle errors
const runCommand = (command, errorMessage) => {
  try {
    log(`Running: ${command}`, colors.cyan);
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    log(errorMessage || `Failed to execute: ${command}`, colors.red);
    log(error.message, colors.red);
    return false;
  }
};

// Check if the .env file exists
const checkEnvFile = () => {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    log('WARNING: No .env file found. You need to create one for production.', colors.yellow);
    log('See the README.md for required environment variables.', colors.yellow);
    return false;
  }
  
  // Check for required variables
  const envContent = fs.readFileSync(envPath, 'utf8');
  const requiredVars = [
    'NODE_ENV',
    'PORT',
    'DATABASE_URL',
    'JWT_SECRET'
  ];
  
  const missingVars = requiredVars.filter(variable => !envContent.includes(`${variable}=`));
  if (missingVars.length > 0) {
    log(`WARNING: Missing required environment variables: ${missingVars.join(', ')}`, colors.yellow);
    return false;
  }
  
  return true;
};

// Main deployment function
const deploy = async () => {
  log('Starting deployment preparation...', colors.green);
  
  // Check Node.js version
  const nodeVersion = process.version;
  log(`Using Node.js version: ${nodeVersion}`, colors.cyan);
  
  if (!checkEnvFile()) {
    log('Environment setup incomplete. Please check your .env file.', colors.yellow);
  }
  
  // Install dependencies
  log('Installing production dependencies...', colors.green);
  if (!runCommand('npm install --production', 'Failed to install dependencies')) {
    return;
  }
  
  // Generate Prisma client
  log('Generating Prisma client...', colors.green);
  if (!runCommand('npx prisma generate', 'Failed to generate Prisma client')) {
    return;
  }
  
  // Ask if we should run database migrations
  log('Do you want to run database migrations? (y/n)', colors.yellow);
  process.stdin.once('data', (data) => {
    const input = data.toString().trim().toLowerCase();
    if (input === 'y' || input === 'yes') {
      log('Running database migrations...', colors.green);
      if (runCommand('npx prisma migrate deploy', 'Failed to run migrations')) {
        log('Migrations completed successfully.', colors.green);
      }
    }
    
    log('Deployment preparation completed!', colors.green);
    log('You can now start the server with: npm run prod', colors.green);
    process.exit(0);
  });
};

// Run the deployment
deploy().catch(err => {
  log(`Deployment preparation failed: ${err.message}`, colors.red);
  process.exit(1);
}); 