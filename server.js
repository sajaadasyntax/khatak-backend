const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const prisma = require('./lib/prisma');

// Load environment variables
dotenv.config();

// Load configuration based on environment
const config = require('./config');

// Initialize Express app
const app = express();
const PORT = config.server.port || process.env.PORT || 5000;

// CORS configuration
const corsOptions = config.cors || {
  origin: process.env.FRONTEND_URL || 'https://www.katakksa.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Use appropriate logging based on environment
const logFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(logFormat));

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

// Special route for driver uploads with bypassed auth
const { uploadDriverDocuments } = require('./config/cloudinary');

app.post('/api/driver/upload/license', uploadDriverDocuments.single('licenseDocument'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'fail',
        message: 'No file uploaded'
      });
    }

    // Return the uploaded file URL
    const documentUrl = req.file.path; // Cloudinary URL

    res.status(200).json({
      status: 'success',
      data: {
        documentUrl,
        message: 'License document uploaded successfully'
      }
    });
  } catch (error) {
    console.error('Error uploading license document:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload license document'
    });
  }
});

app.post('/api/driver/upload/registration', uploadDriverDocuments.single('registrationDocument'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'fail',
        message: 'No file uploaded'
      });
    }

    // Return the uploaded file URL
    const documentUrl = req.file.path; // Cloudinary URL

    res.status(200).json({
      status: 'success',
      data: {
        documentUrl,
        message: 'Registration document uploaded successfully'
      }
    });
  } catch (error) {
    console.error('Error uploading registration document:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload registration document'
    });
  }
});

app.post('/api/driver/upload/driver-photo', uploadDriverDocuments.single('backgroundCheckDocument'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'fail',
        message: 'No file uploaded'
      });
    }

    // Return the uploaded file URL
    const documentUrl = req.file.path; // Cloudinary URL

    res.status(200).json({
      status: 'success',
      data: {
        documentUrl,
        message: 'Driver photo uploaded successfully'
      }
    });
  } catch (error) {
    console.error('Error uploading driver photo:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload driver photo'
    });
  }
});

app.post('/api/driver/upload/insurance', uploadDriverDocuments.single('insuranceDocument'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'fail',
        message: 'No file uploaded'
      });
    }

    // Return the uploaded file URL
    const documentUrl = req.file.path; // Cloudinary URL

    res.status(200).json({
      status: 'success',
      data: {
        documentUrl,
        message: 'Insurance document uploaded successfully'
      }
    });
  } catch (error) {
    console.error('Error uploading insurance document:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload insurance document'
    });
  }
});

app.use('/api/drivers', driverRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/driver', driverRoutes);

// Remove debug routes in production
if (process.env.NODE_ENV !== 'production') {
  // Debug route
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
}

// Root route
app.get('/', (req, res) => {
  res.send('Khatak API is running');
});

// Health check endpoint for monitoring
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// Error handler middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Avoid leaking error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Something went wrong!' 
    : err.message;
    
  res.status(500).json({
    status: 'error',
    message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`Server is configured to use domain: ${config.server.domain || 'localhost'}`);
}); 