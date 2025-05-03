const prisma = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const { randomBytes } = require('crypto');
const responseHandler = require('../utils/responseHandler');

/**
 * Get Admin Dashboard Data (statistics and recent activities)
 */
exports.getDashboardData = async (req, res) => {
  try {
    // Get count statistics
    const [
      totalOrders,
      activeOrders,
      completedOrders,
      pendingOrders,
      totalUsers,
      totalDrivers,
      pendingDrivers,
      revenueStats
    ] = await Promise.all([
      // Total orders
      prisma.order.count(),
      
      // Active orders (IN_TRANSIT, ACCEPTED, PICKED_UP)
      prisma.order.count({
        where: {
          status: {
            in: ['IN_TRANSIT', 'ACCEPTED', 'PICKED_UP']
          }
        }
      }),
      
      // Completed orders
      prisma.order.count({
        where: {
          status: 'DELIVERED'
        }
      }),
      
      // Pending orders
      prisma.order.count({
        where: {
          status: 'PENDING'
        }
      }),
      
      // Total users
      prisma.user.count(),
      
      // Total drivers
      prisma.user.count({
        where: {
          role: 'DRIVER',
          isConfirmed: true
        }
      }),
      
      // Pending drivers
      prisma.user.count({
        where: {
          role: 'DRIVER',
          isConfirmed: false
        }
      }),
      
      // Revenue calculations
      calculateRevenue()
    ]);

    // Get recent orders (5)
    const recentOrders = await prisma.order.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Get recent users (5)
    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        isConfirmed: true
      }
    });

    // Format data for frontend
    const formattedRecentOrders = recentOrders.map(order => ({
      id: order.id,
      trackingNumber: order.trackingNumber,
      status: order.status,
      clientName: order.client?.name || 'Unknown',
      driverName: order.driver?.name || 'Unassigned',
      createdAt: order.createdAt,
      price: order.price
    }));

    res.status(200).json({
      status: 'success',
      data: {
        stats: {
          totalOrders,
          activeOrders,
          completedOrders,
          pendingOrders,
          totalUsers,
          totalDrivers,
          pendingDrivers,
          revenue: revenueStats
        },
        recentOrders: formattedRecentOrders,
        recentUsers
      }
    });
  } catch (error) {
    console.error('Error getting admin dashboard data:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch admin dashboard data'
    });
  }
};

/**
 * Calculate revenue statistics
 */
async function calculateRevenue() {
  const now = new Date();
  
  // Start of today
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  
  // Start of this week (Sunday)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  
  // Start of this month
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  
  // Get completed orders with payment status PAID for different time periods
  const [todayOrders, weekOrders, monthOrders] = await Promise.all([
    // Today's revenue
    prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        paymentStatus: 'PAID',
        updatedAt: {
          gte: todayStart
        }
      },
      select: {
        price: true
      }
    }),
    
    // This week's revenue
    prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        paymentStatus: 'PAID',
        updatedAt: {
          gte: weekStart
        }
      },
      select: {
        price: true
      }
    }),
    
    // This month's revenue
    prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        paymentStatus: 'PAID',
        updatedAt: {
          gte: monthStart
        }
      },
      select: {
        price: true
      }
    })
  ]);
  
  // Calculate sum of prices
  const today = todayOrders.reduce((sum, order) => sum + (order.price || 0), 0);
  const thisWeek = weekOrders.reduce((sum, order) => sum + (order.price || 0), 0);
  const thisMonth = monthOrders.reduce((sum, order) => sum + (order.price || 0), 0);
  
  return {
    today,
    thisWeek,
    thisMonth
  };
}

/**
 * Get all users with filtering and pagination
 */
exports.getUsers = async (req, res) => {
  try {
    const { role, isActive, search, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * parseInt(limit);
    
    // Build filter conditions
    const where = {};
    
    if (role && role !== 'ALL') {
      where.role = role.toUpperCase();
    }
    
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Query for users with pagination
    const [users, totalUsers] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          isConfirmed: true,
          createdAt: true,
          lastLogin: true,
          phone: true,
          // Only include _count for clients
          ...(role === 'CLIENT' ? {
            _count: {
              select: {
                clientOrders: true
              }
            }
          } : {})
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: parseInt(limit)
      }),
      prisma.user.count({ where })
    ]);
    
    // Format response
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      isConfirmed: user.isConfirmed,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      phoneNumber: user.phone,
      totalOrders: user.role === 'CLIENT' && user._count ? user._count.clientOrders : undefined
    }));
    
    const totalPages = Math.ceil(totalUsers / parseInt(limit));
    
    res.status(200).json({
      status: 'success',
      results: users.length,
      totalPages,
      currentPage: parseInt(page),
      data: {
        users: formattedUsers
      }
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch users'
    });
  }
};

/**
 * Update user status (active/inactive)
 */
exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;
    
    if (isActive === undefined) {
      return res.status(400).json({
        status: 'fail',
        message: 'isActive field is required'
      });
    }
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isConfirmed: true
      }
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update user status'
    });
  }
};

/**
 * Reset user password
 */
exports.resetUserPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'No user found with that email'
      });
    }
    
    // Generate a random temporary password
    const tempPassword = randomBytes(8).toString('hex');
    
    // Hash the temporary password
    const hashedPassword = await bcrypt.hash(tempPassword, 12);
    
    // Update user password
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });
    
    // In a real app, you would send an email with the temporary password
    // For this example, we'll just return it in the response
    
    res.status(200).json({
      status: 'success',
      message: 'Password has been reset successfully',
      // Only for demonstration - in production, send password via email only
      tempPassword: process.env.NODE_ENV === 'development' ? tempPassword : undefined
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reset password'
    });
  }
};

/**
 * Get pending driver applications
 */
exports.getPendingDrivers = async (req, res) => {
  try {
    console.log('Fetching pending drivers...');
    const pendingDrivers = await prisma.user.findMany({
      where: {
        role: 'DRIVER',
        isConfirmed: false
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        driverProfile: true
      }
    });
    
    console.log('Found pending drivers:', JSON.stringify(pendingDrivers, null, 2));
    
    // Format the response
    const formattedDrivers = pendingDrivers.map(driver => {
      console.log('Processing driver:', driver.id);
      console.log('Driver profile:', JSON.stringify(driver.driverProfile, null, 2));
      
      return {
        id: driver.id,
        driverId: driver.id,
        name: driver.name,
        email: driver.email,
        phoneNumber: driver.phone,
        applicationDate: driver.createdAt,
        status: 'PENDING',
        // Add driver profile details if available
        ...(driver.driverProfile ? {
          vehicleInfo: {
            make: driver.driverProfile.vehicleMake,
            model: driver.driverProfile.vehicleModel,
            year: driver.driverProfile.vehicleYear,
            color: driver.driverProfile.vehicleColor,
            licensePlate: driver.driverProfile.vehicleRegistration
          },
          licenseInfo: {
            licenseNumber: driver.driverProfile.licenseNumber,
            expiryDate: driver.driverProfile.licenseExpiry
          },
          documents: {
            driversLicense: driver.driverProfile.licenseDocument,
            vehicleRegistration: driver.driverProfile.registrationDocument,
            insurance: driver.driverProfile.insuranceDocument,
            backgroundCheck: driver.driverProfile.backgroundCheckDocument
          }
        } : {})
      };
    });
    
    console.log('Formatted drivers:', JSON.stringify(formattedDrivers, null, 2));
    
    res.status(200).json({
      status: 'success',
      results: formattedDrivers.length,
      data: {
        drivers: formattedDrivers
      }
    });
  } catch (error) {
    console.error('Error getting pending drivers:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch pending drivers'
    });
  }
};

/**
 * Approve a driver application
 */
exports.approveDriver = async (req, res) => {
  try {
    const { driverId } = req.params;
    
    // Update driver status to confirmed
    const updatedDriver = await prisma.user.update({
      where: { id: driverId },
      data: { isConfirmed: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isConfirmed: true
      }
    });
    
    // Send notification to the driver
    const notificationController = require('./notificationController');
    await notificationController.sendDriverApprovalNotification(driverId);
    
    res.status(200).json({
      status: 'success',
      data: {
        driver: updatedDriver
      }
    });
  } catch (error) {
    console.error('Error approving driver:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to approve driver'
    });
  }
};

/**
 * Reject a driver application
 */
exports.rejectDriver = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({
        status: 'fail',
        message: 'Rejection reason is required'
      });
    }
    
    // In a real app, you would store the rejection reason and notify the driver
    
    // Delete the driver account
    await prisma.user.delete({
      where: { id: driverId }
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Driver application has been rejected'
    });
  } catch (error) {
    console.error('Error rejecting driver:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reject driver'
    });
  }
};

/**
 * Get all orders with filtering and pagination for admin
 */
exports.getOrders = async (req, res) => {
  try {
    console.log('Admin getOrders called with query:', req.query);
    
    const { 
      status, 
      clientId, 
      driverId, 
      search, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 10 
    } = req.query;
    
    const skip = (page - 1) * parseInt(limit);
    
    // Build filter conditions
    const where = {};
    
    if (status && status !== 'ALL') {
      where.status = status.toUpperCase();
    }
    
    if (clientId) {
      where.clientId = clientId;
    }
    
    if (driverId) {
      where.driverId = driverId;
    }
    
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { trackingNumber: { contains: search, mode: 'insensitive' } },
        { 
          client: { 
            name: { contains: search, mode: 'insensitive' } 
          } 
        },
        { 
          driver: { 
            name: { contains: search, mode: 'insensitive' } 
          } 
        },
        { pickupAddress: { contains: search, mode: 'insensitive' } },
        { deliveryAddress: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    } else if (startDate) {
      where.createdAt = {
        gte: new Date(startDate)
      };
    } else if (endDate) {
      where.createdAt = {
        lte: new Date(endDate)
      };
    }
    
    console.log('Orders query where clause:', JSON.stringify(where));
    
    // Query for orders with pagination
    try {
      console.log('Executing Prisma query for orders...');
      const [orders, totalOrders] = await Promise.all([
        prisma.order.findMany({
          where,
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            },
            driver: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip,
          take: parseInt(limit)
        }),
        prisma.order.count({ where })
      ]);
      
      console.log(`Found ${orders.length} orders out of ${totalOrders} total`);
      
      // Format orders for response
      const formattedOrders = orders.map(order => {
        try {
          return {
            id: order.id,
            orderNumber: order.orderNumber || order.trackingNumber,
            status: order.status,
            pickupAddress: typeof order.pickupAddress === 'string' 
              ? JSON.parse(order.pickupAddress) 
              : order.pickupAddress,
            deliveryAddress: typeof order.deliveryAddress === 'string' 
              ? JSON.parse(order.deliveryAddress) 
              : order.deliveryAddress,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            customer: order.client ? {
              id: order.client.id,
              name: order.client.name,
              email: order.client.email,
              phoneNumber: order.client.phone
            } : null,
            driver: order.driver ? {
              id: order.driver.id,
              name: order.driver.name,
              email: order.driver.email,
              phoneNumber: order.driver.phone
            } : null,
            items: [],
            specialInstructions: order.specialInstructions || order.notes || '',
            packageDetails: typeof order.packageDetails === 'string' 
              ? JSON.parse(order.packageDetails) 
              : order.packageDetails || {},
            totalAmount: order.totalAmount || order.price || 0
          };
        } catch (formatError) {
          console.error('Error formatting order:', formatError);
          console.error('Problem order data:', JSON.stringify(order, null, 2));
          // Return a minimal valid order object if formatting fails
          return {
            id: order.id,
            status: order.status || 'UNKNOWN',
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
          };
        }
      });
      
      const totalPages = Math.ceil(totalOrders / parseInt(limit));
      
      console.log('Successfully formatted orders response');
      
      res.status(200).json({
        status: 'success',
        results: orders.length,
        totalPages,
        currentPage: parseInt(page),
        data: formattedOrders
      });
    } catch (dbError) {
      console.error('Database error in getOrders:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }
  } catch (error) {
    console.error('Error getting orders:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch orders',
      details: error.message
    });
  }
};

/**
 * Update order status
 */
exports.updateOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, paymentStatus, driverId } = req.body;
    
    // Prepare update data
    const updateData = {};
    
    if (status) {
      updateData.status = status.toUpperCase();
    }
    
    if (paymentStatus) {
      updateData.paymentStatus = paymentStatus.toUpperCase();
    }
    
    if (driverId) {
      updateData.driverId = driverId;
    }
    
    // Update the order
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    // Format response
    const formattedOrder = {
      id: updatedOrder.id,
      trackingNumber: updatedOrder.trackingNumber,
      status: updatedOrder.status,
      pickupAddress: updatedOrder.pickupAddress,
      deliveryAddress: updatedOrder.deliveryAddress,
      clientId: updatedOrder.clientId,
      driverId: updatedOrder.driverId,
      createdAt: updatedOrder.createdAt,
      updatedAt: updatedOrder.updatedAt,
      clientName: updatedOrder.client?.name,
      driverName: updatedOrder.driver?.name,
      price: updatedOrder.price,
      paymentStatus: updatedOrder.paymentStatus,
      packageDetails: updatedOrder.packageDetails
    };
    
    res.status(200).json({
      status: 'success',
      data: {
        order: formattedOrder
      }
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update order'
    });
  }
};

/**
 * Get a specific order by ID
 */
exports.getOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log(`Getting order details for ID: ${orderId}`);
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });
    
    if (!order) {
      return res.status(404).json({
        status: 'fail',
        message: 'Order not found'
      });
    }
    
    console.log(`Found order: ${order.id}`);
    
    try {
      // Format order for response
      const formattedOrder = {
        id: order.id,
        orderNumber: order.orderNumber || order.trackingNumber,
        status: order.status,
        pickupAddress: typeof order.pickupAddress === 'string' 
          ? JSON.parse(order.pickupAddress) 
          : order.pickupAddress,
        deliveryAddress: typeof order.deliveryAddress === 'string' 
          ? JSON.parse(order.deliveryAddress) 
          : order.deliveryAddress,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        customer: order.client ? {
          id: order.client.id,
          name: order.client.name,
          email: order.client.email,
          phoneNumber: order.client.phone
        } : null,
        driver: order.driver ? {
          id: order.driver.id,
          name: order.driver.name,
          email: order.driver.email,
          phoneNumber: order.driver.phone
        } : null,
        items: [],
        specialInstructions: order.specialInstructions || order.notes || '',
        packageDetails: typeof order.packageDetails === 'string' 
          ? JSON.parse(order.packageDetails) 
          : order.packageDetails || {},
        totalAmount: order.totalAmount || order.price || 0
      };
      
      res.status(200).json({
        status: 'success',
        data: formattedOrder
      });
    } catch (formatError) {
      console.error('Error formatting order response:', formatError);
      // If formatting fails, return a simpler version
      res.status(200).json({
        status: 'success',
        data: {
          id: order.id,
          trackingNumber: order.trackingNumber,
          status: order.status,
          createdAt: order.createdAt
        }
      });
    }
  } catch (error) {
    console.error('Error getting order details:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch order details',
      details: error.message
    });
  }
};

// Assign driver to order
exports.assignDriverToOrder = async (req, res) => {
  try {
    const { driverId } = req.body;
    const orderId = req.params.orderId;

    if (!driverId) {
      return responseHandler.badRequest(res, 'Driver ID is required');
    }

    // Check if order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!order) {
      return responseHandler.notFound(res, 'Order not found');
    }

    // Check if driver exists and is approved
    const driver = await prisma.user.findFirst({
      where: {
        id: driverId,
        role: 'DRIVER',
        isApproved: true
      }
    });

    if (!driver) {
      return responseHandler.badRequest(res, 'Driver not found or not approved');
    }

    // Update the order with the assigned driver
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        driverId: driverId,
        status: 'ACCEPTED',
        updatedAt: new Date()
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });

    // Send notification to the driver
    try {
      const notificationController = require('./notificationController');
      await notificationController.sendOrderAssignedNotification(driverId, order);
    } catch (notificationError) {
      console.error('Error sending notification to driver:', notificationError);
      // Continue even if notification fails
    }

    return responseHandler.success(res, updatedOrder, 'Driver assigned to order successfully');
  } catch (error) {
    console.error('Error assigning driver to order:', error);
    return responseHandler.error(res, error.message);
  }
};

/**
 * Get all driver applications with pagination, search, and filtering
 * @route GET /api/admin/driver-approvals
 * @access Admin only
 */
exports.getDriverApplications = async (req, res) => {
  try {
    const { status = 'PENDING', search, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    
    console.log(`Getting driver applications with status=${status}, search=${search}, page=${pageNum}, limit=${limitNum}`);
    
    // Build the filter conditions
    const where = {
      role: 'DRIVER',
    };
    
    // Filter by status
    if (status && status !== 'ALL') {
      if (status === 'PENDING') {
        where.isConfirmed = false;
      } else if (status === 'APPROVED') {
        where.isConfirmed = true;
        // Additional logic for approved drivers if needed
      } else if (status === 'REJECTED') {
        where.isConfirmed = false;
        // You would need a rejected flag or field in your schema
        // where.isRejected = true;
      }
    }
    
    // Search by name or email
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Query for users with pagination and count in parallel
    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          driver_profile: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limitNum
      }),
      prisma.user.count({ where })
    ]);
    
    console.log(`Found ${users.length} driver applications out of ${totalCount} total`);
    
    // Format the response
    const formattedDrivers = users.map(user => {
      // Determine status
      let status = 'PENDING';
      if (user.isConfirmed) {
        status = 'APPROVED';
      } else if (user.driver_profile?.isRejected) {
        status = 'REJECTED';
      }
      
      return {
        id: user.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phone || 'N/A',
        applicationDate: user.createdAt.toISOString(),
        vehicleInfo: {
          make: user.driver_profile?.vehicleMake || 'N/A',
          model: user.driver_profile?.vehicleModel || 'N/A',
          year: user.driver_profile?.vehicleYear || 'N/A',
          licensePlate: user.driver_profile?.vehicleRegistration || 'N/A'
        },
        licenseInfo: {
          licenseNumber: user.driver_profile?.licenseNumber || 'N/A',
          expiryDate: user.driver_profile?.licenseExpiry ? user.driver_profile.licenseExpiry.toISOString() : 'N/A'
        },
        status
      };
    });
    
    const totalPages = Math.ceil(totalCount / limitNum);
    
    return res.status(200).json({
      status: 'success',
      results: formattedDrivers.length,
      totalPages,
      currentPage: pageNum,
      data: {
        drivers: formattedDrivers
      }
    });
  } catch (error) {
    console.error('Error getting driver applications:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch driver applications'
    });
  }
};

/**
 * Get a specific driver application by ID
 * @route GET /api/admin/driver-approvals/:id
 * @access Admin only
 */
exports.getDriverApplication = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`Getting driver application with ID: ${id}`);
    
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        driver_profile: true
      }
    });
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'Driver application not found'
      });
    }
    
    if (user.role !== 'DRIVER') {
      return res.status(400).json({
        status: 'fail',
        message: 'User is not a driver'
      });
    }
    
    // Determine status
    let status = 'PENDING';
    if (user.isConfirmed) {
      status = 'APPROVED';
    } else if (user.driver_profile?.isRejected) {
      status = 'REJECTED';
    }
    
    const driverApplication = {
      id: user.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phone || 'N/A',
      applicationDate: user.createdAt.toISOString(),
      vehicleInfo: {
        make: user.driver_profile?.vehicleMake || 'N/A',
        model: user.driver_profile?.vehicleModel || 'N/A',
        year: user.driver_profile?.vehicleYear || 'N/A',
        licensePlate: user.driver_profile?.vehicleRegistration || 'N/A'
      },
      licenseInfo: {
        licenseNumber: user.driver_profile?.licenseNumber || 'N/A',
        expiryDate: user.driver_profile?.licenseExpiry ? user.driver_profile.licenseExpiry.toISOString() : 'N/A'
      },
      status
    };
    
    return res.status(200).json({
      status: 'success',
      data: {
        driver: driverApplication
      }
    });
  } catch (error) {
    console.error('Error getting driver application:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch driver application'
    });
  }
};

/**
 * Approve a driver application
 * @route POST /api/admin/driver-approvals/:id/approve
 * @access Admin only
 */
exports.approveDriverApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    
    console.log(`Approving driver application with ID: ${id} by admin: ${adminId}`);
    
    // Check if user exists and is a driver
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        driver_profile: true
      }
    });
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'Driver application not found'
      });
    }
    
    if (user.role !== 'DRIVER') {
      return res.status(400).json({
        status: 'fail',
        message: 'User is not a driver'
      });
    }
    
    if (user.isConfirmed) {
      return res.status(400).json({
        status: 'fail',
        message: 'Driver application already approved'
      });
    }
    
    // Update user and driver profile
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        isConfirmed: true,
      }
    });
    
    // Update driver profile if it exists
    if (user.driver_profile) {
      await prisma.driver_profile.update({
        where: { id: user.driver_profile.id },
        data: {
          isApproved: true,
          isRejected: false,
          approvedAt: new Date(),
          approvedBy: adminId,
          rejectedAt: null,
          rejectedBy: null,
          rejectionReason: null
        }
      });
    }
    
    // TODO: Send email notification to the driver
    
    return res.status(200).json({
      status: 'success',
      message: 'Driver application approved successfully',
      data: {
        userId: updatedUser.id,
        status: 'APPROVED'
      }
    });
  } catch (error) {
    console.error('Error approving driver application:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to approve driver application'
    });
  }
};

/**
 * Reject a driver application
 * @route POST /api/admin/driver-approvals/:id/reject
 * @access Admin only
 */
exports.rejectDriverApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;
    
    console.log(`Rejecting driver application with ID: ${id} by admin: ${adminId}`);
    
    if (!reason) {
      return res.status(400).json({
        status: 'fail',
        message: 'Rejection reason is required'
      });
    }
    
    // Check if user exists and is a driver
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        driver_profile: true
      }
    });
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'Driver application not found'
      });
    }
    
    if (user.role !== 'DRIVER') {
      return res.status(400).json({
        status: 'fail',
        message: 'User is not a driver'
      });
    }
    
    // Update driver profile if it exists
    if (user.driver_profile) {
      await prisma.driver_profile.update({
        where: { id: user.driver_profile.id },
        data: {
          isApproved: false,
          isRejected: true,
          rejectedAt: new Date(),
          rejectedBy: adminId,
          rejectionReason: reason,
          approvedAt: null,
          approvedBy: null
        }
      });
    }
    
    // TODO: Send email notification to the driver about rejection
    
    return res.status(200).json({
      status: 'success',
      message: 'Driver application rejected successfully',
      data: {
        userId: user.id,
        status: 'REJECTED',
        reason
      }
    });
  } catch (error) {
    console.error('Error rejecting driver application:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to reject driver application'
    });
  }
};

/**
 * Get a driver's profile details
 * @route GET /api/admin/drivers/:id/profile
 * @access Admin only
 */
exports.getDriverProfile = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`Fetching driver profile for driver ID: ${id}`);
    
    const driver = await prisma.user.findUnique({
      where: { 
        id,
        role: 'DRIVER'
      },
      include: {
        driver_profile: true
      }
    });
    
    if (!driver) {
      return res.status(404).json({
        status: 'fail',
        message: 'Driver not found'
      });
    }
    
    // Format the driver data with the profile information
    const driverData = {
      id: driver.id,
      name: driver.name,
      email: driver.email,
      phoneNumber: driver.phone || 'N/A',
      role: driver.role,
      isActive: driver.isActive,
      isConfirmed: driver.isConfirmed,
      createdAt: driver.createdAt,
      lastLogin: driver.lastLogin,
      driver_profile: driver.driver_profile ? {
        licenseNumber: driver.driver_profile.licenseNumber,
        licenseExpiry: driver.driver_profile.licenseExpiry,
        vehicleMake: driver.driver_profile.vehicleMake,
        vehicleModel: driver.driver_profile.vehicleModel,
        vehicleYear: driver.driver_profile.vehicleYear,
        vehicleColor: driver.driver_profile.vehicleColor,
        vehicleRegistration: driver.driver_profile.vehicleRegistration,
        licenseDocument: driver.driver_profile.licenseDocument,
        registrationDocument: driver.driver_profile.registrationDocument,
        insuranceDocument: driver.driver_profile.insuranceDocument,
        backgroundCheckDocument: driver.driver_profile.backgroundCheckDocument,
        isApproved: driver.driver_profile.isApproved,
        approvedAt: driver.driver_profile.approvedAt,
        isRejected: driver.driver_profile.isRejected,
        rejectedAt: driver.driver_profile.rejectedAt,
        rejectionReason: driver.driver_profile.rejectionReason
      } : null
    };
    
    return res.status(200).json({
      status: 'success',
      data: driverData
    });
  } catch (error) {
    console.error('Error fetching driver profile:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch driver profile'
    });
  }
};

/**
 * Update user information by admin
 * @route PUT /api/admin/users/:userId
 */
exports.updateUserInfo = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, phone, isActive, isConfirmed } = req.body;
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!existingUser) {
      return responseHandler.notFound(res, 'User not found');
    }
    
    // Verify email uniqueness if it's being updated
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email }
      });
      
      if (emailExists) {
        return responseHandler.badRequest(res, 'Email is already in use');
      }
    }
    
    // Update user information
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone && { phone }),
        ...(isActive !== undefined && { isActive }),
        ...(isConfirmed !== undefined && { isConfirmed })
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        isConfirmed: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    return responseHandler.success(res, {
      message: 'User information updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user information:', error);
    return responseHandler.serverError(res, 'Failed to update user information');
  }
}; 