/**
 * Production environment configuration
 */
module.exports = {
  // Server configuration
  server: {
    port: process.env.PORT || 5000,
    domain: 'api.katakksa.com',
  },
  
  // CORS settings
  cors: {
    origin: process.env.FRONTEND_URL || 'https://katakksa.com',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  },
  
  // Database settings
  database: {
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true }
  },
  
  // JWT settings
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  },
  
  // Logging configuration
  logging: {
    level: 'info',
    format: 'combined'
  }
}; 