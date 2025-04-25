const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const prisma = require('./lib/prisma');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('dev'));

// Routes import
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const driverRoutes = require('./routes/driverRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

// Content routes for frontend
const contentRoutes = require('./routes/contentRoutes');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/uploads', uploadRoutes);

// Debug route (remove in production)
app.get('/api/debug', (req, res) => {
  res.json({
    status: 'success',
    message: 'Debug endpoint is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    routes: {
      auth: '/api/auth',
      orders: '/api/orders',
      users: '/api/users',
      content: '/api/content',
      admin: '/api/admin',
      notifications: '/api/notifications'
    }
  });
});

// More detailed order route debug
app.get('/api/debug/orders', (req, res) => {
  try {
    const orderRoutesStack = orderRoutes.stack;
    const routes = orderRoutesStack.map(layer => {
      if (layer.route) {
        return {
          path: layer.route.path,
          methods: Object.keys(layer.route.methods).map(m => m.toUpperCase())
        };
      }
      return {
        name: layer.name,
        keys: layer.keys
      };
    });
    
    res.json({
      status: 'success',
      message: 'Order routes debug info',
      routes
    });
  } catch (error) {
    res.json({
      status: 'error',
      message: 'Failed to get order routes debug info',
      error: error.message
    });
  }
});

// Root route
app.get('/', (req, res) => {
  res.send('Shipping Company API is running');
});

// Error handler middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong!'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 