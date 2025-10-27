// utils/orderProcessing.js
const Order = require('../models/Order');
const Chef = require('../models/Chef');

/**
 * Check and auto-complete orders that have finished processing
 * This should be called periodically (e.g., via cron job or on each request)
 */
const checkAndCompleteOrders = async () => {
  try {
    const processingOrders = await Order.find({ status: 'processing' });
    const now = new Date();
    
    for (const order of processingOrders) {
      if (!order.processingStartTime) {
        continue;
      }
      
      const elapsedMinutes = Math.floor(
        (now - order.processingStartTime.getTime()) / (1000 * 60)
      );
      
      // If processing time is complete, mark as done
      if (elapsedMinutes >= order.totalPreparationTime) {
        order.status = 'done';
        await order.save();
        
        // Update chef's order count
        if (order.chefAssigned) {
          const chef = await Chef.findById(order.chefAssigned);
          if (chef) {
            chef.currentOrdersCount = Math.max(0, chef.currentOrdersCount - 1);
            chef.assignedOrders = chef.assignedOrders.filter(
              orderId => orderId.toString() !== order._id.toString()
            );
            await chef.save();
          }
        }
        
        console.log(`Order ${order.orderId} automatically completed`);
      }
    }
  } catch (error) {
    console.error('Error in checkAndCompleteOrders:', error);
  }
};

/**
 * Get remaining processing time for an order
 */
const getRemainingTime = (order) => {
  if (!order.processingStartTime || order.status !== 'processing') {
    return null;
  }
  
  const elapsedMinutes = Math.floor(
    (Date.now() - order.processingStartTime.getTime()) / (1000 * 60)
  );
  
  const remainingTime = Math.max(0, order.totalPreparationTime - elapsedMinutes);
  
  return {
    elapsedTime: elapsedMinutes,
    remainingTime,
    isOverdue: remainingTime === 0 && order.status === 'processing'
  };
};

/**
 * Initialize default chefs if none exist
 */
const initializeChefs = async () => {
  try {
    const chefCount = await Chef.countDocuments();
    
    if (chefCount === 0) {
      const defaultChefs = [
        { name: 'Chef Mario', currentOrdersCount: 0, assignedOrders: [] },
        { name: 'Chef Luigi', currentOrdersCount: 0, assignedOrders: [] },
        { name: 'Chef Peach', currentOrdersCount: 0, assignedOrders: [] },
        { name: 'Chef Toad', currentOrdersCount: 0, assignedOrders: [] }
      ];
      
      await Chef.insertMany(defaultChefs);
      console.log('✅ Default chefs initialized');
    }
  } catch (error) {
    console.error('Error initializing chefs:', error);
  }
};

/**
 * Get order statistics
 */
const getOrderStatistics = async () => {
  try {
    const [
      totalOrders,
      pendingOrders,
      processingOrders,
      doneOrders,
      servedOrders
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: 'processing' }),
      Order.countDocuments({ status: 'done' }),
      Order.countDocuments({ status: 'served' })
    ]);
    
    return {
      total: totalOrders,
      pending: pendingOrders,
      processing: processingOrders,
      done: doneOrders,
      served: servedOrders
    };
  } catch (error) {
    console.error('Error getting order statistics:', error);
    return null;
  }
};

module.exports = {
  checkAndCompleteOrders,
  getRemainingTime,
  initializeChefs,
  getOrderStatistics
};