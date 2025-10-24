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
exports.createOrder = async (req, res, next) => {
  try {
    const { items, orderType, customerInfo, cookingInstructions, tableNumber } = req.body;
    
    let totalPrice = 0;
    let totalPreparationTime = 0;
    const orderItems = [];
    
    // Validate and process items
    for (const item of items) {
      const menuItem = await Menu.findById(item.menuItem);
      
      if (!menuItem) {
        return res.status(404).json({ 
          success: false, 
          message: `Menu item not found: ${item.menuItem}` 
        });
      }
      
      if (menuItem.stock < item.quantity) {
        return res.status(400).json({ 
          success: false, 
          message: `Insufficient stock for ${menuItem.name}. Available: ${menuItem.stock}` 
        });
      }
      
      // Update stock
      menuItem.stock -= item.quantity;
      await menuItem.save();
      
      totalPrice += menuItem.price * item.quantity;
      totalPreparationTime = Math.max(totalPreparationTime, menuItem.averagePreparationTime);
      
      orderItems.push({
        menuItem: menuItem._id,
        name: menuItem.name,
        quantity: item.quantity,
        price: menuItem.price,
        preparationTime: menuItem.averagePreparationTime
      });
    }
    
    // Handle table reservation for dine-in
    if (orderType === 'dineIn' && tableNumber) {
      const table = await Table.findOne({ tableNumber });
      
      if (!table) {
        return res.status(404).json({ 
          success: false, 
          message: 'Table not found' 
        });
      }
      
      if (table.isReserved) {
        return res.status(400).json({ 
          success: false, 
          message: 'Table is already reserved' 
        });
      }
      
      table.isReserved = true;
      table.reservedBy = {
        customerName: customerInfo.name,
        phoneNumber: customerInfo.phoneNumber,
        numberOfMembers: customerInfo.numberOfMembers
      };
      await table.save();
    }
    
    // Assign chef
    const chef = await assignChefToOrder();
    
    // Create order
    const order = new Order({
      orderId: generateOrderId(),
      items: orderItems,
      totalPrice,
      orderType,
      customerInfo,
      cookingInstructions,
      tableNumber: orderType === 'dineIn' ? tableNumber : null,
      chefAssigned: chef ? chef._id : null,
      processingStartTime: new Date(),
      totalPreparationTime,
      status: 'processing'
    });
    
    await order.save();
    
    // Update chef's order count
    if (chef) {
      chef.currentOrdersCount += 1;
      chef.assignedOrders.push(order._id);
      await chef.save();
    }
    
    await order.populate('items.menuItem');
    await order.populate('chefAssigned', 'name');
    
    res.status(201).json({ 
      success: true, 
      data: order 
    });
  } catch (error) {
    next(error);
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