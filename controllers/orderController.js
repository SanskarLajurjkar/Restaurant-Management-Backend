// controllers/orderController.js
const Order = require('../models/Order');
const Menu = require('../models/Menu');
const Chef = require('../models/Chef');
const Table = require('../models/Table');

// Generate unique order ID
const generateOrderId = () => {
  return 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
};

// Assign order to chef with fewer orders
const assignChefToOrder = async () => {
  try {
    const chefs = await Chef.find().sort({ currentOrdersCount: 1 });
    
    if (chefs.length === 0) {
      return null;
    }
    
    const minCount = chefs[0].currentOrdersCount;
    const availableChefs = chefs.filter(chef => chef.currentOrdersCount === minCount);
    
    return availableChefs[Math.floor(Math.random() * availableChefs.length)];
  } catch (error) {
    console.error('Error assigning chef:', error);
    return null;
  }
};

// Auto-assign chef to order
const autoAssignChef = async (orderId) => {
  try {
    // Get available chefs
    const availableChefs = await Chef.find({ status: 'available' })
      .sort({ currentOrders: 1 })
      .limit(1);

    if (availableChefs.length === 0) {
      return false;
    }

    const chef = availableChefs[0];
    
    // Assign order to chef
    await Order.findByIdAndUpdate(orderId, {
      chefId: chef._id,
      status: 'processing'
    });

    return true;
  } catch (error) {
    console.error('Chef assignment failed:', error);
    return false;
  }
};

// @desc    Get all orders
// @route   GET /api/orders
exports.getAllOrders = async (req, res, next) => {
  try {
    const { status, orderType } = req.query;
    let query = {};
    
    if (status) query.status = status;
    if (orderType) query.orderType = orderType;
    
    const orders = await Order.find(query)
      .populate('items.menuItem')
      .populate('chefAssigned', 'name')
      .sort({ createdAt: -1 });
    
    res.json({ 
      success: true, 
      count: orders.length,
      data: orders 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.menuItem')
      .populate('chefAssigned', 'name');
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    res.json({ 
      success: true, 
      data: order 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get orders by chef
// @route   GET /api/orders/chef/:chefId
exports.getOrdersByChef = async (req, res, next) => {
  try {
    const orders = await Order.find({ 
      chefAssigned: req.params.chefId,
      status: { $in: ['pending', 'processing'] }
    }).populate('items.menuItem');
    
    res.json({ 
      success: true, 
      count: orders.length,
      data: orders 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new order
// @route   POST /api/orders
exports.createOrder = async (req, res) => {
  try {
    const newOrder = await Order.create(req.body);
    
    // Attempt automatic chef assignment
    const isAssigned = await autoAssignChef(newOrder._id);
    
    if (!isAssigned) {
      // Notify admin of unassigned order
      notifyAdmin({
        type: 'UNASSIGNED_ORDER',
        orderId: newOrder._id,
        message: 'New order requires manual chef assignment'
      });
    }

    res.status(201).json({
      success: true,
      data: newOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Order creation failed'
    });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    order.status = status;
    
    // Update chef's order count when order is done or served
    if ((status === 'done' || status === 'served') && order.chefAssigned) {
      const chef = await Chef.findById(order.chefAssigned);
      if (chef) {
        chef.currentOrdersCount = Math.max(0, chef.currentOrdersCount - 1);
        chef.assignedOrders = chef.assignedOrders.filter(
          orderId => orderId.toString() !== order._id.toString()
        );
        await chef.save();
      }
    }
    
    // Unreserve table when order is served
    if (status === 'served' && order.orderType === 'dineIn' && order.tableNumber) {
      const table = await Table.findOne({ tableNumber: order.tableNumber });
      if (table) {
        table.isReserved = false;
        table.reservedBy = {};
        await table.save();
      }
    }
    
    await order.save();
    await order.populate('items.menuItem');
    await order.populate('chefAssigned', 'name');
    
    res.json({ 
      success: true, 
      data: order 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete order
// @route   DELETE /api/orders/:id
exports.deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Order deleted successfully',
      data: order
    });
  } catch (error) {
    next(error);
  }
};
