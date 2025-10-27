// controllers/analyticsController.js
const Order = require('../models/Order');
const Chef = require('../models/Chef');

// @desc    Get main dashboard analytics
// @route   GET /api/analytics/dashboard
exports.getDashboardMetrics = async (req, res, next) => {
  try {
    // Total Chefs
    const totalChefs = await Chef.countDocuments();
    
    // Total Revenue
    const revenueResult = await Order.aggregate([
      { $match: { status: { $in: ['done', 'served'] } } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;
    
    // Total Orders
    const totalOrders = await Order.countDocuments();
    
    // Total Unique Clients
    const uniqueClients = await Order.distinct('customerInfo.phoneNumber');
    const totalClients = uniqueClients.length;
    
    res.json({
      success: true,
      data: {
        chefs: totalChefs,
        totalRevenue,
        totalOrders,
        totalClients
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get orders summary with filters
// @route   GET /api/analytics/orders-summary?filter=daily|weekly|monthly
exports.getOrdersSummary = async (req, res, next) => {
  try {
    const { filter = 'daily' } = req.query;
    let startDate;
    const endDate = new Date();
    
    switch (filter) {
      case 'daily':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      default:
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
    }
    
    const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    const served = orders.filter(o => o.status === 'served').length;
    const dineIn = orders.filter(o => o.orderType === 'dineIn').length;
    const takeaway = orders.filter(o => o.orderType === 'takeaway').length;
    
    const revenue = orders
      .filter(o => o.status === 'served' || o.status === 'done')
      .reduce((sum, order) => sum + order.totalPrice, 0);
    
    res.json({
      success: true,
      data: {
        filter,
        served,
        dineIn,
        takeaway,
        revenue,
        period: {
          start: startDate,
          end: endDate
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get graph data
// @route   GET /api/analytics/graph?type=daily|weekly|monthly|yearly
exports.getGraphData = async (req, res, next) => {
  try {
    const { type = 'daily' } = req.query;
    let groupBy, startDate;
    const endDate = new Date();
    
    switch (type) {
      case 'daily':
        groupBy = { $hour: '$createdAt' };
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        groupBy = { $dayOfWeek: '$createdAt' };
        startDate = new Date();
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'monthly':
        groupBy = { $dayOfMonth: '$createdAt' };
        startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'yearly':
        groupBy = { $month: '$createdAt' };
        startDate = new Date();
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        groupBy = { $hour: '$createdAt' };
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
    }
    
    const graphData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $in: ['done', 'served'] }
        }
      },
      {
        $group: {
          _id: groupBy,
          revenue: { $sum: '$totalPrice' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    const formattedData = graphData.map(item => {
      let label;
      switch (type) {
        case 'daily':
          label = `${item._id}:00`;
          break;
        case 'weekly':
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          label = days[item._id - 1];
          break;
        case 'monthly':
          label = `Day ${item._id}`;
          break;
        case 'yearly':
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          label = months[item._id - 1];
          break;
        default:
          label = item._id;
      }
      
      return {
        label,
        revenue: item.revenue,
        orders: item.orders
      };
    });
    
    res.json({
      success: true,
      data: {
        type,
        graphData: formattedData,
        period: {
          start: startDate,
          end: endDate
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get real-time order processing times
// @route   GET /api/analytics/order-processing
exports.getOrderProcessing = async (req, res, next) => {
  try {
    const activeOrders = await Order.find({ 
      status: 'processing' 
    })
    .populate('items.menuItem', 'name')
    .populate('chefAssigned', 'name')
    .sort({ createdAt: 1 });
    
    const ordersWithTimeRemaining = activeOrders.map(order => {
      const elapsedMinutes = Math.floor(
        (Date.now() - order.processingStartTime.getTime()) / (1000 * 60)
      );
      const remainingTime = Math.max(0, order.totalPreparationTime - elapsedMinutes);
      
      return {
        ...order.toObject(),
        elapsedTime: elapsedMinutes,
        remainingTime,
        isOverdue: remainingTime === 0
      };
    });
    
    res.json({
      success: true,
      count: ordersWithTimeRemaining.length,
      data: ordersWithTimeRemaining
    });
  } catch (error) {
    next(error);
  }
};

const monitorOrderProcessing = async () => {
  const overdueThreshold = 15; // minutes
  
  const overdueOrders = await Order.find({
    status: 'processing',
    createdAt: {
      $lt: new Date(Date.now() - overdueThreshold * 60000)
    }
  });

  overdueOrders.forEach(order => {
    notifyAdmin({
      type: 'OVERDUE_ORDER',
      orderId: order._id,
      waitTime: Math.floor((Date.now() - order.createdAt) / 60000)
    });
  });
<<<<<<< HEAD
};
=======
};
>>>>>>> feature/order-processing
