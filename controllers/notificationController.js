const prisma = require('../lib/prisma');
const responseHandler = require('../utils/responseHandler');

/**
 * Get notifications for a user
 */
exports.getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get or create user notifications
    let userNotifications = await prisma.userNotification.findUnique({
      where: { userId }
    });
    
    if (!userNotifications) {
      // Create a new notifications entry if one doesn't exist
      userNotifications = await prisma.userNotification.create({
        data: {
          userId,
          notifications: []
        }
      });
    }
    
    return responseHandler.success(res, {
      notifications: userNotifications.notifications || []
    });
  } catch (error) {
    console.error('Error getting user notifications:', error);
    return responseHandler.serverError(res, error);
  }
};

/**
 * Mark notifications as read
 */
exports.markNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationIds } = req.body;
    
    if (!notificationIds || !Array.isArray(notificationIds)) {
      return responseHandler.validationError(res, { message: 'Invalid notification IDs' });
    }
    
    // Find user's notifications
    const userNotification = await prisma.userNotification.findUnique({
      where: { userId }
    });
    
    if (!userNotification) {
      return responseHandler.success(res, { message: 'No notifications to update' });
    }
    
    const notifications = userNotification.notifications || [];
    
    // Mark notifications as read
    const updatedNotifications = notifications.map(notification => {
      if (notificationIds.includes(notification.id)) {
        return { ...notification, read: true };
      }
      return notification;
    });
    
    // Update user notifications
    await prisma.userNotification.update({
      where: { userId },
      data: {
        notifications: updatedNotifications
      }
    });
    
    return responseHandler.success(res, { message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return responseHandler.serverError(res, error);
  }
};

/**
 * Send notification to a driver when account is approved
 */
exports.sendDriverApprovalNotification = async (driverId) => {
  try {
    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      select: {
        name: true,
        notifications: true
      }
    });
    
    if (!driver) {
      console.error(`Driver with ID ${driverId} not found`);
      return;
    }
    
    // Get or create user notifications
    let userNotification = await prisma.userNotification.findUnique({
      where: { userId: driverId }
    });
    
    const existingNotifications = userNotification?.notifications || [];
    
    const newNotification = {
      id: Date.now().toString(),
      title: "Account Approved",
      message: `Congratulations ${driver.name}! Your driver account has been approved. You can now start accepting delivery orders.`,
      type: "ACCOUNT_APPROVAL",
      read: false,
      createdAt: new Date().toISOString()
    };
    
    if (userNotification) {
      // Update existing notifications
      await prisma.userNotification.update({
        where: { userId: driverId },
        data: {
          notifications: [...existingNotifications, newNotification]
        }
      });
    } else {
      // Create new notifications entry
      await prisma.userNotification.create({
        data: {
          userId: driverId,
          notifications: [newNotification]
        }
      });
    }
    
    console.log(`Approval notification sent to driver ${driverId}`);
    return true;
  } catch (error) {
    console.error('Error sending driver approval notification:', error);
    return false;
  }
};

/**
 * Send notification to drivers about new orders
 */
exports.sendNewOrdersAvailableNotification = async () => {
  try {
    // Find drivers who don't have active orders (not handling any orders)
    const driversWithNoActiveOrders = await prisma.user.findMany({
      where: {
        role: 'DRIVER',
        isConfirmed: true,
        isActive: true,
        driverOrders: {
          none: {
            status: {
              in: ['ACCEPTED', 'PICKED_UP', 'IN_TRANSIT']
            }
          }
        }
      },
      select: {
        id: true,
        name: true,
        notifications: true
      }
    });
    
    if (driversWithNoActiveOrders.length === 0) {
      console.log('No available drivers to notify about new orders');
      return;
    }
    
    // Check if there are any pending orders
    const pendingOrders = await prisma.order.count({
      where: {
        status: 'PENDING'
      }
    });
    
    if (pendingOrders === 0) {
      console.log('No pending orders to notify about');
      return;
    }
    
    // Send notification to each available driver
    for (const driver of driversWithNoActiveOrders) {
      // Get or create user notifications
      let userNotification = await prisma.userNotification.findUnique({
        where: { userId: driver.id }
      });
      
      const existingNotifications = userNotification?.notifications || [];
      
      const newNotification = {
        id: Date.now().toString() + `-${driver.id.substring(0, 4)}`,
        title: "New Orders Available",
        message: `There are ${pendingOrders} new orders available. Check the available orders page to accept one.`,
        type: "NEW_ORDERS_AVAILABLE",
        read: false,
        createdAt: new Date().toISOString()
      };
      
      if (userNotification) {
        // Update existing notifications
        await prisma.userNotification.update({
          where: { userId: driver.id },
          data: {
            notifications: [...existingNotifications, newNotification]
          }
        });
      } else {
        // Create new notifications entry
        await prisma.userNotification.create({
          data: {
            userId: driver.id,
            notifications: [newNotification]
          }
        });
      }
      
      console.log(`New orders notification sent to driver ${driver.id}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error sending new orders notification:', error);
    return false;
  }
};

/**
 * Send notification to a driver when they are assigned to an order
 */
exports.sendOrderAssignedNotification = async (driverId, order) => {
  try {
    if (!driverId || !order) {
      console.error('Missing driver ID or order data for notification');
      return;
    }

    // Get the driver
    const driver = await prisma.user.findUnique({
      where: {
        id: driverId,
        role: 'DRIVER'
      }
    });

    if (!driver) {
      console.error('Driver not found for notification:', driverId);
      return;
    }

    // Get or create user notifications
    let userNotification = await prisma.userNotification.findUnique({
      where: { userId: driverId }
    });
    
    const existingNotifications = userNotification?.notifications || [];
    
    // Create the notification content
    const newNotification = {
      id: Date.now().toString(),
      title: 'New Order Assigned',
      message: `You have been assigned to order #${order.trackingNumber || order.id.substring(0, 8)}`,
      type: 'ORDER_ASSIGNED',
      read: false,
      createdAt: new Date().toISOString(),
      data: {
        orderId: order.id,
        pickupAddress: order.pickupAddress,
        deliveryAddress: order.deliveryAddress
      }
    };
    
    if (userNotification) {
      // Update existing notifications
      await prisma.userNotification.update({
        where: { userId: driverId },
        data: {
          notifications: [...existingNotifications, newNotification]
        }
      });
    } else {
      // Create new notifications entry
      await prisma.userNotification.create({
        data: {
          userId: driverId,
          notifications: [newNotification]
        }
      });
    }

    console.log(`Notification sent to driver ${driverId} about order assignment`);
    return newNotification;
  } catch (error) {
    console.error('Error sending order assigned notification:', error);
    return false;
  }
};

/**
 * Send notification to a client when order status is updated
 */
exports.sendOrderStatusUpdateNotification = async (orderId, newStatus, previousStatus) => {
  try {
    if (!orderId || !newStatus) {
      console.error('Missing orderId or status for notification');
      return;
    }

    // Get the order with client information
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        client: {
          select: {
            id: true,
            name: true
          }
        },
        driver: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!order || !order.client) {
      console.error('Order or client not found for notification:', orderId);
      return;
    }

    const clientId = order.client.id;
    
    // Format status for display (replace underscores with spaces and capitalize)
    const formatStatus = (status) => {
      return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    // Get or create user notifications for the client
    let userNotification = await prisma.userNotification.findUnique({
      where: { userId: clientId }
    });
    
    const existingNotifications = userNotification?.notifications || [];
    
    // Create the notification content based on status change
    let title = 'Order Status Updated';
    let message = `Your order #${order.trackingNumber || order.id.substring(0, 8)} status has been updated to ${formatStatus(newStatus)}`;
    
    // Customize message based on status
    switch(newStatus) {
      case 'ACCEPTED':
        message = `Driver ${order.driver.name} has accepted your order #${order.trackingNumber || order.id.substring(0, 8)}`;
        break;
      case 'PICKED_UP':
        message = `Your order #${order.trackingNumber || order.id.substring(0, 8)} has been picked up by the driver`;
        break;
      case 'IN_TRANSIT':
        message = `Your order #${order.trackingNumber || order.id.substring(0, 8)} is now in transit to the delivery location`;
        break;
      case 'DELIVERED':
        title = 'Order Delivered';
        message = `Your order #${order.trackingNumber || order.id.substring(0, 8)} has been delivered successfully`;
        break;
      case 'CANCELLED':
        title = 'Order Cancelled';
        message = `Your order #${order.trackingNumber || order.id.substring(0, 8)} has been cancelled`;
        break;
    }
    
    const newNotification = {
      id: Date.now().toString(),
      title,
      message,
      type: 'ORDER_STATUS_UPDATE',
      read: false,
      createdAt: new Date().toISOString(),
      data: {
        orderId: order.id,
        previousStatus,
        newStatus,
        trackingNumber: order.trackingNumber
      }
    };
    
    if (userNotification) {
      // Update existing notifications
      await prisma.userNotification.update({
        where: { userId: clientId },
        data: {
          notifications: [...existingNotifications, newNotification]
        }
      });
    } else {
      // Create new notifications entry
      await prisma.userNotification.create({
        data: {
          userId: clientId,
          notifications: [newNotification]
        }
      });
    }

    console.log(`Notification sent to client ${clientId} about order status update to ${newStatus}`);
    return newNotification;
  } catch (error) {
    console.error('Error sending order status update notification:', error);
    return false;
  }
}; 