const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// Get home page content
router.get('/home', async (req, res) => {
  try {
    const content = {
      hero: {
        title: 'Fast & Reliable Shipping Services',
        subtitle: 'We connect you with professional drivers to deliver your packages safely and on time.',
        cta: {
          primary: { text: 'Sign Up', link: '/register' },
          secondary: { text: 'Login', link: '/login' }
        }
      },
      services: [
        {
          icon: 'bi-box-seam',
          title: 'Package Shipping',
          description: 'Fast and secure delivery of your packages to any destination.'
        },
        {
          icon: 'bi-truck',
          title: 'Same-Day Delivery',
          description: 'Get your packages delivered on the same day within city limits.'
        },
        {
          icon: 'bi-geo-alt',
          title: 'Real-Time Tracking',
          description: 'Track your package\'s location in real-time throughout its journey.'
        }
      ],
      howItWorks: [
        {
          step: 1,
          title: 'Create an Order',
          description: 'Enter your package details and shipping information.'
        },
        {
          step: 2,
          title: 'Driver Assignment',
          description: 'A nearby driver accepts your delivery request.'
        },
        {
          step: 3,
          title: 'Package Delivery',
          description: 'Your package is picked up and delivered to its destination.'
        }
      ],
      cta: {
        title: 'Ready to Ship Your Package?',
        subtitle: 'Join thousands of satisfied customers who trust our shipping service.',
        buttonText: 'Get Started',
        buttonLink: '/register'
      }
    };
    
    res.json(content);
  } catch (error) {
    console.error('Error fetching home content:', error);
    res.status(500).json({ error: 'Failed to fetch home content' });
  }
});

// Get dashboard stats
router.get('/dashboard/stats', async (req, res) => {
  try {
    // Get real stats from database
    const totalOrders = await prisma.order.count();
    const pendingOrders = await prisma.order.count({
      where: { status: 'PENDING' }
    });
    const inTransitOrders = await prisma.order.count({
      where: { status: 'IN_TRANSIT' }
    });
    const deliveredOrders = await prisma.order.count({
      where: { status: 'DELIVERED' }
    });
    const totalUsers = await prisma.user.count({
      where: { role: 'CLIENT' }
    });
    const totalDrivers = await prisma.user.count({
      where: { role: 'DRIVER' }
    });
    
    // Generate sample revenue data
    const averageOrderPrice = 45;
    const estimatedRevenue = totalOrders * averageOrderPrice;
    
    // Sample chart data
    const ordersByMonth = [45, 59, 80, 81, 56, 55, 40, 65, 70, 78, 85, 92];
    const revenueByMonth = ordersByMonth.map(orders => orders * averageOrderPrice);
    
    const stats = {
      summary: {
        totalOrders,
        pendingOrders,
        inTransitOrders,
        deliveredOrders,
        totalUsers,
        totalDrivers,
        estimatedRevenue
      },
      charts: {
        ordersByMonth,
        revenueByMonth,
        recentOrders: await prisma.order.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            client: {
              select: {
                name: true,
                email: true
              }
            }
          }
        })
      }
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

module.exports = router; 