/**
 * Configuration loader
 * Loads the appropriate configuration based on the environment
 */
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Determine environment
const env = process.env.NODE_ENV || 'development';

// Load environment-specific configuration
let config;
try {
  config = require(`./${env}`);
  console.log(`Loaded ${env} configuration`);
} catch (error) {
  console.warn(`No configuration found for ${env} environment, using production config`);
  config = require('./production');
}

module.exports = config; 