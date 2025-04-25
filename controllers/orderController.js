const prisma = require('../lib/prisma');
const responseHandler = require('../utils/responseHandler');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const paymentController = require('./paymentController');
const notificationController = require('./notificationController');

// Create a new order
exports.createOrder = async (req, res) => {
  try {
    // Extract order data from request
    const orderData = { ...req.body };
    
    // Normalize status fields to uppercase for enum compatibility in Prisma
    if (orderData.status) {
      orderData.status = orderData.status.toUpperCase();
    }
    
    if (orderData.paymentStatus) {
      orderData.paymentStatus = orderData.paymentStatus.toUpperCase();
    }
    
    // Use the client ID from the authenticated user
    const clientId = req.user.id;
    
    // Generate a tracking number
    const trackingNumber = 'SHP' + 
      Date.now().toString().slice(-6) + 
      Math.floor(Math.random() * 1000);
    
    console.log('Creating order with data:', JSON.stringify({
      ...orderData,
      clientId,
      trackingNumber
    }));

    // Create the order using Prisma
    const newOrder = await prisma.order.create({
      data: {
        clientId: clientId,
        trackingNumber: trackingNumber,
        pickupAddress: orderData.pickupAddress,
        deliveryAddress: orderData.deliveryAddress,
        packageDetails: orderData.packageDetails,
        status: orderData.status || 'PENDING',
        price: orderData.price || 0,
        paymentStatus: orderData.paymentStatus || 'PENDING',
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        }
      }
    });
    
    console.log('Order created successfully:', newOrder.id);
    
    // Send notification to available drivers
    try {
      await notificationController.sendNewOrdersAvailableNotification();
    } catch (notificationError) {
      console.error('Error sending notifications:', notificationError);
      // Continue with order creation even if notifications fail
    }
    
    return responseHandler.success(res, newOrder, 'Order created successfully', 201);
  } catch (error) {
    console.error('Order creation error:', error);
    return responseHandler.error(res, error.message);
  }
};

// Get all orders with filtering
exports.getAllOrders = async (req, res) => {
  try {
    // Extract query parameters
    const { status, clientId, driverId, skip, take } = req.query;
    
    // Build filter object
    const filter = {};
    
    // Apply filters based on query parameters
    if (status) filter.status = status;
    if (clientId) filter.clientId = clientId;
    if (driverId) filter.driverId = driverId;
    
    // Apply role-based access control
    if (req.user.role === 'CLIENT') {
      // Clients can only see their own orders
      filter.clientId = req.user.id;
    } else if (req.user.role === 'DRIVER') {
      // Drivers can see pending orders or their assigned orders
      filter.OR = [
        { status: 'PENDING' },
        { driverId: req.user.id }
      ];
    }
    
    // Parse pagination parameters
    const parsedSkip = skip ? parseInt(skip, 10) : 0;
    const parsedTake = take ? parseInt(take, 10) : 10;
    
    // Get orders from database
    const orders = await prisma.order.findMany({
      where: filter,
      include: {
        client: true,
        driver: true,
        payment: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: parsedSkip,
      take: parsedTake
    });
    
    // Count total orders that match the filter
    const totalOrders = await prisma.order.count({
      where: filter
    });
    
    return responseHandler.success(
      res, 
      {
        orders,
        pagination: {
          total: totalOrders,
          skip: parsedSkip,
          take: parsedTake
        }
      }, 
      'Orders retrieved successfully'
    );
  } catch (error) {
    return responseHandler.error(res, error.message);
  }
};

// Get single order by ID
exports.getOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    
    const order = await prisma.order.findUnique({
      where: {
        id: orderId
      },
      include: {
        client: true,
        driver: true,
        payment: true
      }
    });

    if (!order) {
      return responseHandler.notFound(res, 'No order found with that ID');
    }

    // Check if user has permission to access this order
    if (
      req.user.role === 'CLIENT' &&
      order.clientId !== req.user.id
    ) {
      return responseHandler.forbidden(res, 'You do not have permission to access this order');
    }

    if (
      req.user.role === 'DRIVER' &&
      order.driverId &&
      order.driverId !== req.user.id &&
      order.status !== 'PENDING'
    ) {
      return responseHandler.forbidden(res, 'You do not have permission to access this order');
    }

    return responseHandler.success(res, order, 'Order retrieved successfully');
  } catch (error) {
    return responseHandler.error(res, error.message);
  }
};

// Update order status
exports.updateOrderStatus = catchAsync(async (req, res, next) => {
  const orderId = req.params.id;
  const { status } = req.body;

  console.log('Updating order status:', { orderId, status });

  if (!status) {
    return next(new AppError('Status is required', 400));
  }

  // Check if order exists
  const order = await prisma.order.findUnique({
    where: { id: orderId }
  });

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  console.log('Found order:', order);
  
  // Store the previous status for notification
  const previousStatus = order.status;

  // Set actual delivery time if status is DELIVERED
  let updateData = { status };
  if (status === 'DELIVERED') {
    updateData.actualDeliveryTime = new Date();
  }

  // Update order status
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: updateData
  });

  console.log('Updated order:', updatedOrder);

  // If order is marked as DELIVERED, track the payment
  if (status === 'DELIVERED' && order.driverId) {
    console.log('Order marked as delivered, tracking payment...');
    try {
      // Track the unpaid order
      await paymentController.trackOrderPayment(orderId);
      console.log('Payment tracking completed successfully');
    } catch (error) {
      console.error('Error tracking payment:', error);
      // Don't throw the error, just log it
      // We still want to return success for the order update
    }
  }

  // Send notification to client about status update
  try {
    await notificationController.sendOrderStatusUpdateNotification(orderId, status, previousStatus);
    console.log('Client notification sent successfully');
  } catch (error) {
    console.error('Error sending client notification:', error);
    // Don't throw error, just log it
  }

  // Get the updated order with all related data
  const finalOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        }
      },
      driver: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        }
      }
    }
  });

  res.status(200).json({
    status: 'success',
    message: 'Order updated successfully',
    data: {
      order: finalOrder
    }
  });
});

// Driver accepts an order
exports.acceptOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const driverId = req.user.id;

    // Check if driver already has an active order
    const activeOrders = await prisma.order.findMany({
      where: {
        driverId: driverId,
        status: {
          in: ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT']
        }
      }
    });

    if (activeOrders.length > 0) {
      return responseHandler.badRequest(
        res, 
        'You already have an active order. Please complete or cancel your current order before accepting a new one.'
      );
    }

    // Check if driver has 3 or more unconfirmed payments
    const unconfirmedPayments = await prisma.payment.findMany({
      where: {
        driverId: driverId,
        driverConfirmed: false
      }
    });

    if (unconfirmedPayments.length >= 3) {
      return responseHandler.badRequest(
        res, 
        'You have 3 or more unconfirmed payments. Please confirm your pending payments before accepting new orders.'
      );
    }

    // Find the order to get the previous status
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!existingOrder) {
      return responseHandler.notFound(res, 'No order found with that ID');
    }

    const previousStatus = existingOrder.status;

    // Update order with Prisma
    const order = await prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        driverId: driverId,
        status: 'ACCEPTED',
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        }
      }
    });

    // Send notification to driver and client
    try {
      // Notify driver they've been assigned
      await notificationController.sendOrderAssignedNotification(driverId, order);
      
      // Notify client their order has been accepted
      await notificationController.sendOrderStatusUpdateNotification(orderId, 'ACCEPTED', previousStatus);
      
      console.log('Order acceptance notifications sent successfully');
    } catch (error) {
      console.error('Error sending order acceptance notifications:', error);
      // Don't throw error, just log it
    }

    return responseHandler.success(res, order, 'Order accepted successfully');
  } catch (error) {
    // Check for specific error types
    if (error.code === 'P2025') {
      return responseHandler.notFound(res, 'No order found with that ID');
    }
    
    return responseHandler.error(res, error.message);
  }
};

// Cancel an order (client, driver, or admin)
exports.cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;

    // Find the order with Prisma
    const existingOrder = await prisma.order.findUnique({
      where: {
        id: orderId
      }
    });

    if (!existingOrder) {
      return responseHandler.notFound(res, 'No order found with that ID');
    }

    // Check if user has permission to cancel this order
    if (req.user.role === 'CLIENT' && existingOrder.clientId !== req.user.id) {
      return responseHandler.forbidden(res, 'You do not have permission to cancel this order');
    }

    if (req.user.role === 'DRIVER' && existingOrder.driverId !== req.user.id) {
      return responseHandler.forbidden(res, 'You do not have permission to cancel this delivery');
    }

    // Check if order can be cancelled based on user role
    const orderStatus = existingOrder.status;
    if (req.user.role === 'CLIENT' && !['PENDING', 'ACCEPTED'].includes(orderStatus)) {
      return responseHandler.error(res, `Cannot cancel order in "${orderStatus}" status`);
    }

    if (req.user.role === 'DRIVER' && !['ACCEPTED', 'PICKED_UP'].includes(orderStatus)) {
      return responseHandler.error(res, `Cannot cancel delivery in "${orderStatus}" status`);
    }

    // Store previous status for notification
    const previousStatus = existingOrder.status;

    // Update status to cancelled
    const order = await prisma.order.update({
      where: {
        id: orderId
      },
      data: {
        status: 'CANCELLED',
        // If driver is cancelling, remove them from the order
        ...(req.user.role === 'DRIVER' && { driverId: null })
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        }
      }
    });

    // Send notifications about cancellation
    try {
      // Notify client about cancellation
      if (order.clientId) {
        await notificationController.sendOrderStatusUpdateNotification(orderId, 'CANCELLED', previousStatus);
      }
      
      // If a driver was assigned, notify them as well
      if (order.driverId) {
        // Create custom notification for driver about cancellation
        let userNotification = await prisma.userNotification.findUnique({
          where: { userId: order.driverId }
        });
        
        const existingNotifications = userNotification?.notifications || [];
        
        const newNotification = {
          id: Date.now().toString(),
          title: 'Order Cancelled',
          message: `Order #${order.trackingNumber || order.id.substring(0, 8)} has been cancelled`,
          type: 'ORDER_CANCELLED',
          read: false,
          createdAt: new Date().toISOString(),
          data: {
            orderId: order.id,
            previousStatus,
            trackingNumber: order.trackingNumber
          }
        };
        
        if (userNotification) {
          await prisma.userNotification.update({
            where: { userId: order.driverId },
            data: {
              notifications: [...existingNotifications, newNotification]
            }
          });
        } else {
          await prisma.userNotification.create({
            data: {
              userId: order.driverId,
              notifications: [newNotification]
            }
          });
        }
      }
    } catch (error) {
      console.error('Error sending cancellation notifications:', error);
      // Don't throw error, just log it
    }

    return responseHandler.success(res, order, 'Order cancelled successfully');
  } catch (error) {
    return responseHandler.error(res, error.message);
  }
};

// Get client's current orders
exports.getCurrentOrders = async (req, res) => {
  try {
    const clientId = req.params.clientId;
    
    console.log('Current orders requested:', {
      clientId,
      authenticatedUserId: req.user.id,
      authenticatedUserRole: req.user.role
    });
    
    // Normalize the role for case-insensitive comparison
    const userRole = req.user.role.toUpperCase();
    
    // Verify the client is requesting their own orders
    if (userRole === 'CLIENT' && req.user.id !== clientId) {
      console.log('User ID mismatch:', req.user.id, 'vs', clientId);
      return responseHandler.forbidden(res, 'You can only view your own orders');
    }

    // Get current orders (PENDING, ACCEPTED, PICKED_UP, IN_TRANSIT)
    const orders = await prisma.order.findMany({
      where: {
        clientId,
        status: {
          in: ['PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT']
        }
      },
      include: {
        client: true,
        driver: true,
        payment: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${orders.length} current orders for client ${clientId}`);
    return responseHandler.success(res, orders, 'Current orders retrieved successfully');
  } catch (error) {
    console.error('Error fetching current orders:', error);
    return responseHandler.error(res, error.message);
  }
};

// Get dashboard data for client or driver
exports.getDashboardData = async (req, res) => {
  try {
    const userId = req.params.userId;
    const userRole = req.params.role.toUpperCase();
    
    console.log('Dashboard data requested:', {
      userId,
      userRole,
      authenticatedUserId: req.user.id,
      authenticatedUserRole: req.user.role
    });

    // Verify the user is requesting their own data
    if (req.user.id !== userId) {
      console.log('User ID mismatch:', req.user.id, 'vs', userId);
      return responseHandler.forbidden(res, 'You can only view your own dashboard data');
    }

    // Check if role matches (case insensitive)
    const normalizedUserRole = userRole === 'CLIENT' ? 'CLIENT' : 
                              userRole === 'DRIVER' ? 'DRIVER' : 
                              userRole === 'ADMIN' ? 'ADMIN' : null;
                              
    if (!normalizedUserRole) {
      console.log('Invalid role provided:', userRole);
      return responseHandler.badRequest(res, 'Invalid role provided');
    }

    // Build the correct filter based on user role
    let filter = {};
    if (normalizedUserRole === 'CLIENT') {
      filter = { clientId: userId };
    } else if (normalizedUserRole === 'DRIVER') {
      filter = { driverId: userId };
    } else {
      // For admin, we don't add a filter as they can see all orders
    }

    // Get orders for the user with the correct filter
    const orders = await prisma.order.findMany({
      where: filter,
      include: {
        client: true,
        driver: true,
        payment: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`Found ${orders.length} orders for ${normalizedUserRole} ${userId}`);

    // Calculate stats
    const stats = {
      totalOrders: orders.length,
      activeOrders: orders.filter(order => 
        ['PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT'].includes(order.status)
      ).length,
      completedOrders: orders.filter(order => 
        order.status === 'DELIVERED'
      ).length,
      pendingOrders: orders.filter(order => 
        order.status === 'PENDING'
      ).length,
      cancelledOrders: orders.filter(order => 
        order.status === 'CANCELLED'
      ).length
    };

    // Get recent orders (last 5)
    const recentOrders = orders.slice(0, 5);

    return responseHandler.success(res, { stats, recentOrders }, 'Dashboard data retrieved successfully');
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return responseHandler.error(res, error.message);
  }
};

// Get all current orders for admin
exports.getAdminCurrentOrders = async (req, res) => {
  try {
    const adminId = req.params.adminId;
    
    console.log('Admin current orders requested:', {
      adminId,
      authenticatedUserId: req.user.id,
      authenticatedUserRole: req.user.role
    });
    
    // Verify the user is an admin
    if (req.user.role !== 'ADMIN') {
      return responseHandler.forbidden(res, 'Only admins can access this endpoint');
    }

    // Verify the admin is requesting their own data
    if (req.user.id !== adminId) {
      return responseHandler.forbidden(res, 'You can only view your own admin orders');
    }

    // Get all current orders (PENDING, ACCEPTED, PICKED_UP, IN_TRANSIT)
    const orders = await prisma.order.findMany({
      where: {
        status: {
          in: ['PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT']
        }
      },
      include: {
        client: true,
        driver: true, 
        payment: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${orders.length} current orders for admin ${adminId}`);
    return responseHandler.success(res, orders, 'Admin current orders retrieved successfully');
  } catch (error) {
    console.error('Error fetching admin current orders:', error);
    return responseHandler.error(res, error.message);
  }
};

// Get driver's current orders
exports.getCurrentOrdersForDriver = async (req, res) => {
  try {
    const driverId = req.params.driverId;
    
    console.log('Driver current orders requested:', {
      driverId,
      authenticatedUserId: req.user.id,
      authenticatedUserRole: req.user.role
    });
    
    // Verify the driver is requesting their own orders
    if (req.user.role === 'DRIVER' && req.user.id !== driverId) {
      console.log('User ID mismatch:', req.user.id, 'vs', driverId);
      return responseHandler.forbidden(res, 'You can only view your own orders');
    }

    // Get current orders (ACCEPTED, PICKED_UP, IN_TRANSIT)
    const orders = await prisma.order.findMany({
      where: {
        driverId,
        status: {
          in: ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT']
        }
      },
      include: {
        client: true,
        driver: true,
        payment: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return responseHandler.success(res, orders, 'Driver current orders retrieved successfully');
  } catch (error) {
    console.error('Error fetching driver current orders:', error);
    return responseHandler.error(res, error.message);
  }
};

// Update an order (PUT method)
exports.updateOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const updateData = { ...req.body };
    
    // Log the update attempt
    console.log(`Attempting to update order ${orderId} with data:`, updateData);
    
    // Normalize status if present
    if (updateData.status) {
      updateData.status = updateData.status.toUpperCase();
    }
    
    // Normalize payment status if present
    if (updateData.paymentStatus) {
      updateData.paymentStatus = updateData.paymentStatus.toUpperCase();
    }
    
    // Special case: If a driver is accepting an order
    if (req.user.role === 'DRIVER' && updateData.status === 'ACCEPTED') {
      // Ensure the driver ID is set
      updateData.driverId = req.user.id;
      console.log(`Driver ${req.user.id} is accepting order ${orderId}`);
    }
    
    // Check if the order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId }
    });
    
    if (!existingOrder) {
      return responseHandler.notFound(res, 'No order found with that ID');
    }
    
    // If driver is trying to update an order that's not theirs
    if (
      req.user.role === 'DRIVER' && 
      existingOrder.driverId && 
      existingOrder.driverId !== req.user.id &&
      !['PENDING', 'ACCEPTED'].includes(existingOrder.status)
    ) {
      return responseHandler.forbidden(res, 'You do not have permission to update this order');
    }
    
    // If client is trying to update an order that's not theirs
    if (
      req.user.role === 'CLIENT' && 
      existingOrder.clientId !== req.user.id
    ) {
      return responseHandler.forbidden(res, 'You do not have permission to update this order');
    }
    
    // Update the order
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: {
        client: true,
        driver: true,
        payment: true
      }
    });
    
    console.log(`Order ${orderId} updated successfully:`, updatedOrder);
    return responseHandler.success(res, updatedOrder, 'Order updated successfully');
  } catch (error) {
    console.error('Error updating order:', error);
    return responseHandler.error(res, error.message);
  }
}; 