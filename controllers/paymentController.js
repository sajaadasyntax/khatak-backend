const prisma = require('../utils/prisma');
const responseHandler = require('../utils/responseHandler');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

// Commission rate in percentage
const COMMISSION_RATE = 2.5;

// Maximum number of unpaid orders before driver deactivation
const MAX_UNPAID_ORDERS = 3;

/**
 * Get all admin bank accounts
 * @route GET /api/payments/bank-accounts
 */
exports.getBankAccounts = catchAsync(async (req, res, next) => {
  // Allow both drivers and admins to fetch bank accounts
  if (req.user.role !== 'ADMIN' && req.user.role !== 'DRIVER') {
    return next(new AppError('You do not have permission to access bank accounts', 403));
  }

  const bankAccounts = await prisma.bankAccount.findMany({
    orderBy: {
      createdAt: 'desc'
    }
  });

  res.status(200).json({
    status: 'success',
    results: bankAccounts.length,
    data: {
      bankAccounts
    }
  });
});

/**
 * Add a new admin bank account
 * @route POST /api/payments/bank-accounts
 */
exports.addBankAccount = catchAsync(async (req, res, next) => {
  // Only admins can add bank accounts
  if (req.user.role !== 'ADMIN') {
    return next(new AppError('Only admins can add bank accounts', 403));
  }

  const { bankName, accountNumber, accountName, sortCode, description, isActive } = req.body;

  if (!bankName || !accountNumber || !accountName) {
    return next(new AppError('Bank name, account number, and account name are required', 400));
  }

  const newBankAccount = await prisma.bankAccount.create({
    data: {
      bankName,
      accountNumber,
      accountName,
      sortCode,
      description,
      isActive: isActive !== undefined ? isActive : true
    }
  });

  res.status(201).json({
    status: 'success',
    data: {
      bankAccount: newBankAccount
    }
  });
});

/**
 * Update an admin bank account
 * @route PUT /api/payments/bank-accounts/:id
 */
exports.updateBankAccount = catchAsync(async (req, res, next) => {
  // Only admins can update bank accounts
  if (req.user.role !== 'ADMIN') {
    return next(new AppError('Only admins can update bank accounts', 403));
  }

  const { id } = req.params;
  const { bankName, accountNumber, accountName, sortCode, description, isActive } = req.body;

  // Check if bank account exists
  const bankAccount = await prisma.bankAccount.findUnique({
    where: { id }
  });

  if (!bankAccount) {
    return next(new AppError('Bank account not found', 404));
  }

  const updatedBankAccount = await prisma.bankAccount.update({
    where: { id },
    data: {
      bankName,
      accountNumber,
      accountName,
      sortCode,
      description,
      isActive
    }
  });

  res.status(200).json({
    status: 'success',
    data: {
      bankAccount: updatedBankAccount
    }
  });
});

/**
 * Delete an admin bank account
 * @route DELETE /api/payments/bank-accounts/:id
 */
exports.deleteBankAccount = catchAsync(async (req, res, next) => {
  // Only admins can delete bank accounts
  if (req.user.role !== 'ADMIN') {
    return next(new AppError('Only admins can delete bank accounts', 403));
  }

  const { id } = req.params;

  // Check if bank account exists
  const bankAccount = await prisma.bankAccount.findUnique({
    where: { id }
  });

  if (!bankAccount) {
    return next(new AppError('Bank account not found', 404));
  }

  await prisma.bankAccount.delete({
    where: { id }
  });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

/**
 * Get commission amount for an order
 * @route GET /api/payments/commission/:orderId
 */
exports.getOrderCommission = catchAsync(async (req, res, next) => {
  const { orderId } = req.params;

  // Get order details
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      driver: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      },
      payment: {
        select: {
          id: true,
          status: true,
          paymentMethod: true,
          paymentReference: true,
          notes: true
        }
      }
    }
  });

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Only allow driver who is assigned to this order or an admin to view commission
  if (req.user.role !== 'ADMIN' && order.driverId !== req.user.id) {
    return next(new AppError('You do not have permission to view this commission', 403));
  }

  // Calculate commission amount
  const commissionAmount = (order.price * COMMISSION_RATE) / 100;

  // Determine payment status
  let paymentStatus = 'UNPAID';
  
  if (order.commissionPaid) {
    paymentStatus = 'CONFIRMED';
  } else if (order.payment) {
    paymentStatus = order.payment.status;
  }

  res.status(200).json({
    status: 'success',
    data: {
      order: {
        id: order.id,
        trackingNumber: order.trackingNumber,
        price: order.price,
        commissionPaid: order.commissionPaid
      },
      commissionRate: COMMISSION_RATE,
      commissionAmount,
      paymentStatus,
      payment: order.payment
    }
  });
});

/**
 * Submit payment for an order
 * @route POST /api/payments/submit/:orderId
 */
exports.submitPayment = catchAsync(async (req, res, next) => {
  const { orderId } = req.params;
  const { paymentMethod, paymentReference, paymentScreenshot } = req.body;

  if (!paymentMethod || !paymentReference) {
    return next(new AppError('Payment method and reference are required', 400));
  }

  // Get order details
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payment: true
    }
  });

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  // Only the assigned driver can submit payment
  if (order.driverId !== req.user.id) {
    return next(new AppError('You are not authorized to submit payment for this order', 403));
  }

  // Check if order status is DELIVERED
  if (order.status !== 'DELIVERED') {
    return next(new AppError('Payment can only be submitted for delivered orders', 400));
  }

  // Check if payment is already confirmed
  if (order.commissionPaid) {
    return next(new AppError('Commission payment for this order is already confirmed', 400));
  }

  // Calculate commission amount
  const commissionAmount = (order.price * COMMISSION_RATE) / 100;

  // Create or update payment record
  let payment;
  if (order.payment) {
    // Update existing payment
    payment = await prisma.payment.update({
      where: { id: order.payment.id },
      data: {
        paymentMethod,
        paymentReference,
        paymentScreenshot,
        amount: commissionAmount,
        status: 'PENDING',
        notes: null // Clear any previous notes when resubmitting
      }
    });
  } else {
    // Create new payment
    payment = await prisma.payment.create({
      data: {
        orderId,
        driverId: req.user.id,
        paymentMethod,
        paymentReference,
        paymentScreenshot,
        amount: commissionAmount,
        status: 'PENDING'
      }
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      payment
    }
  });
});

/**
 * Admin confirmation of a payment
 * @route PUT /api/payments/confirm/:paymentId
 */
exports.confirmPayment = catchAsync(async (req, res, next) => {
  // Only admins can confirm payments
  if (req.user.role !== 'ADMIN') {
    return next(new AppError('Only admins can confirm payments', 403));
  }

  const { paymentId } = req.params;
  const { status, notes } = req.body;

  if (!status || !['CONFIRMED', 'REJECTED'].includes(status)) {
    return next(new AppError('Valid status (CONFIRMED or REJECTED) is required', 400));
  }

  // Get payment details
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: true,
      driver: true
    }
  });

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  // Update payment status
  const updatedPayment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status,
      notes: notes || null
    }
  });

  // If payment is confirmed, update order
  if (status === 'CONFIRMED') {
    await prisma.order.update({
      where: { id: payment.orderId },
      data: {
        commissionPaid: true
      }
    });
  }

  // Handle driver account status after payment confirmation or rejection
  if (status === 'REJECTED' || status === 'CONFIRMED') {
    await checkDriverStatus(payment.driverId);
  }

  res.status(200).json({
    status: 'success',
    data: {
      payment: updatedPayment
    }
  });
});

/**
 * Get all payments (with filters)
 * @route GET /api/payments
 */
exports.getPayments = catchAsync(async (req, res, next) => {
  try {
    console.log('GET /api/payments request received');
    console.log('User:', req.user);
    
    let filter = {};

    // If not admin, only show payments for the current user
    if (req.user.role !== 'ADMIN') {
      filter.driverId = req.user.id;
      console.log(`Filtering payments for user ${req.user.id}`);
    } 
    // If admin and driverId is specified, filter by that driver
    else if (req.query.driverId) {
      filter.driverId = req.query.driverId;
      console.log(`Admin filtering payments for driver ${req.query.driverId}`);
    }

    // Status filter - default to PENDING for payment confirmation page
    if (req.query.status) {
      filter.status = req.query.status;
      console.log(`Filtering by status: ${filter.status}`);
    }

    console.log('Payment filter:', filter);

    const payments = await prisma.payment.findMany({
      where: filter,
      include: {
        order: {
          select: {
            id: true,
            trackingNumber: true,
            price: true,
            commissionPaid: true,
            status: true,
            actualDeliveryTime: true
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
      }
    });

    console.log(`Found ${payments.length} payments`);
    console.log('Payments:', payments);

    res.status(200).json({
      status: 'success',
      results: payments.length,
      data: {
        payments
      }
    });
  } catch (error) {
    console.error('Error in getPayments:', error);
    next(error);
  }
});

// Utility function to check and update driver status based on unpaid orders
async function checkDriverStatus(driverId) {
  // Get all delivered orders for this driver
  const deliveredOrders = await prisma.order.findMany({
    where: {
      driverId,
      status: 'DELIVERED'
    }
  });

  // Count unpaid orders
  const unpaidOrders = deliveredOrders.filter(order => !order.commissionPaid);

  // If unpaid orders exceed the limit, deactivate driver account
  if (unpaidOrders.length >= MAX_UNPAID_ORDERS) {
    await prisma.user.update({
      where: { id: driverId },
      data: {
        isActive: false
      }
    });
  }
}

// Function to track payments when order is marked as delivered
// To be called from orderController when an order is marked as DELIVERED
exports.trackOrderPayment = catchAsync(async (orderId) => {
  console.log('Starting payment tracking for order:', orderId);
  
  // Get order details
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      driver: true,
      payment: true // Include existing payment if any
    }
  });

  console.log('Found order details:', {
    id: order.id,
    status: order.status,
    driverId: order.driverId,
    price: order.price,
    existingPayment: order.payment
  });

  if (!order || !order.driverId) {
    throw new Error('Order not found or no driver assigned');
  }

  // Calculate commission amount
  const commissionAmount = (order.price * COMMISSION_RATE) / 100;
  console.log('Calculated commission amount:', commissionAmount);

  // Check if payment already exists
  if (order.payment) {
    console.log('Payment already exists for this order:', order.payment);
    return true;
  }

  // Create payment record with default values for required fields
  const payment = await prisma.payment.create({
    data: {
      orderId,
      driverId: order.driverId,
      amount: commissionAmount,
      status: 'PENDING',
      paymentMethod: 'PENDING', // Default value for required field
      paymentReference: `PENDING-${orderId}`, // Default value for required field
      paymentScreenshot: null,
      notes: null
    }
  });

  console.log('Created new payment record:', {
    id: payment.id,
    status: payment.status,
    amount: payment.amount,
    driverId: payment.driverId
  });

  // Check driver status after new unpaid order is added
  await checkDriverStatus(order.driverId);

  return true;
});

/**
 * Get pending payments for a driver (unconfirmed by driver)
 * @route GET /api/payments/driver-pending
 */
exports.getDriverPendingPayments = catchAsync(async (req, res, next) => {
  try {
    console.log('GET /api/payments/driver-pending request received');
    console.log('User:', req.user.id);
    
    // Only drivers can access their pending payments
    if (req.user.role !== 'DRIVER') {
      return next(new AppError('Only drivers can access their pending payments', 403));
    }
    
    // Filter for the current driver's pending payments
    // Focus on payments where driverConfirmed is false or null
    const payments = await prisma.payment.findMany({
      where: {
        driverId: req.user.id,
        driverConfirmed: false
      },
      include: {
        order: {
          select: {
            id: true,
            trackingNumber: true,
            price: true,
            status: true,
            actualDeliveryTime: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${payments.length} pending payments for driver ${req.user.id}`);
    
    res.status(200).json({
      status: 'success',
      results: payments.length,
      data: payments
    });
  } catch (error) {
    console.error('Error in getDriverPendingPayments:', error);
    next(error);
  }
});

/**
 * Driver confirmation of payment (special case)
 * @route PUT /api/payments/driver-confirm/:paymentId
 */
exports.driverConfirmPayment = catchAsync(async (req, res, next) => {
  const { paymentId } = req.params;

  // Get payment details with full order information
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: true
    }
  });

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  // Ensure the driver is only confirming their own payments
  if (payment.driverId !== req.user.id) {
    return next(new AppError('You can only confirm your own payments', 403));
  }

  // Update payment status to indicate driver confirmed
  const updatedPayment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      driverConfirmed: true,
      updatedAt: new Date()
    }
  });

  // NOTE: Notification creation is skipped as the notification model
  // in the schema doesn't match the expected structure

  res.status(200).json({
    status: 'success',
    data: {
      payment: updatedPayment
    }
  });
});

/**
 * Driver reporting an issue with payment
 * @route POST /api/payments/driver-report/:paymentId
 */
exports.driverReportIssue = catchAsync(async (req, res, next) => {
  const { paymentId } = req.params;
  const { issueDetails } = req.body;

  // Get payment details
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: true
    }
  });

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  // Ensure the driver is only reporting issues with their own payments
  if (payment.driverId !== req.user.id) {
    return next(new AppError('You can only report issues with your own payments', 403));
  }

  // Update payment to mark it as having an issue
  const updatedPayment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      hasIssue: true,
      issueDetails: issueDetails || 'Driver reported an issue',
      updatedAt: new Date()
    }
  });

  // Create notification for admin about this issue
  await prisma.notification.create({
    data: {
      userId: null, // will be sent to all admins
      title: 'Payment Issue Reported',
      message: `Driver ${req.user.name} has reported an issue with payment for order #${payment.order.trackingNumber || payment.orderId.substring(0, 8)}`,
      type: 'PAYMENT_ISSUE',
      isRead: false,
      data: {
        paymentId: payment.id,
        orderId: payment.orderId,
        issueDetails: issueDetails || 'Driver reported an issue'
      }
    }
  });

  res.status(200).json({
    status: 'success',
    data: {
      payment: updatedPayment
    }
  });
}); 