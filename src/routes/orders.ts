import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get current orders for a specific driver (excluding DELIVERED and CANCELLED orders)
router.get('/driver/:driverId/current', authenticateJWT, async (req, res) => {
  try {
    const { driverId } = req.params;
    
    // Check if the authenticated user is the driver themselves or an admin
    if (req.user.role !== 'ADMIN' && req.user.id !== parseInt(driverId)) {
      return res.status(403).json({ 
        status: 'error', 
        message: 'You can only view your own current orders' 
      });
    }

    // Fetch current orders for the driver (excluding DELIVERED and CANCELLED)
    const currentOrders = await prisma.order.findMany({
      where: {
        driverId: parseInt(driverId),
        status: {
          notIn: ['DELIVERED', 'CANCELLED']
        }
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true
          }
        },
        pickupAddress: true,
        deliveryAddress: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.status(200).json({
      status: 'success',
      data: currentOrders
    });
  } catch (error) {
    console.error('Error fetching driver current orders:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch current orders',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all orders with optional filters
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const { clientId, driverId, status } = req.query;
    
    // Build filter conditions
    const where: any = {};
    
    if (clientId) {
      where.clientId = parseInt(clientId as string);
    }
    
    if (driverId) {
      where.driverId = parseInt(driverId as string);
    }
    
    if (status) {
      // Handle comma-separated status values
      const statusValues = (status as string).split(',');
      where.status = {
        in: statusValues
      };
    }
    
    console.log('Query where clause:', JSON.stringify(where));
    
    const orders = await prisma.order.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true
          }
        },
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true
          }
        },
        pickupAddress: true,
        deliveryAddress: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return res.status(200).json({
      status: 'success',
      data: orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch orders',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 