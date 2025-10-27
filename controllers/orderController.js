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
const assignChefToOrder = async (orderId) => {
  try {
    const chefs = await Chef.find().sort({ currentOrdersCount: 1 });
    
    if (chefs.length === 0) {
      console.log('No chefs available');
      return null;
    }
    
    // Get chefs with minimum order count
    const minCount = chefs[0].currentOrdersCount;
    const availableChefs = chefs.filter(chef => chef.currentOrdersCount === minCount);
    
    // Randomly select one chef from those with minimum orders
    const selectedChef = availableChefs[Math.floor(Math.random() * availableChefs.length)];
    
    // Update order with chef assignment
    await Order.findByIdAndUpdate(orderId, {
      chefAssigned: selectedChef._id,
      status: 'processing',
      processingStartTime: new Date()
    });
    
    // Update chef's order count
    selectedChef.currentOrdersCount += 1;
    selectedChef.assignedOrders.push(orderId);
    await selectedChef.save();
    
    console.log(`Order ${orderId} assigned to chef ${selectedChef.name}`);
    return selectedChef;
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
    const { items, orderType, customerInfo, tableNumber, cookingInstructions } = req.body;
    
    // Validate and fetch menu items
    const menuItemIds = items.map(item => item.menuItem);
    const menuItems = await Menu.find({ _id: { $in: menuItemIds } });
    
    if (menuItems.length !== items.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more menu items not found'
      });
    }
    
    // Calculate total price and preparation time
    let totalPrice = 0;
    let totalPreparationTime = 0;
    const orderItems = items.map(item => {
      const menuItem = menuItems.find(m => m._id.toString() === item.menuItem.toString());
      
      if (!menuItem) {
        throw new Error(`Menu item ${item.menuItem} not found`);
      }
      
      // Check stock
      if (menuItem.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${menuItem.name}`);
      }
      
      const itemPrice = menuItem.price * item.quantity;
      totalPrice += itemPrice;
      
      // Add preparation time (max of all items, not sum)
      if (menuItem.averagePreparationTime > totalPreparationTime) {
        totalPreparationTime = menuItem.averagePreparationTime;
      }
      
      return {
        menuItem: menuItem._id,
        name: menuItem.name,
        quantity: item.quantity,
        price: menuItem.price,
        preparationTime: menuItem.averagePreparationTime
      };
    });
    
    // Handle dine-in table reservation
    let reservedTableNumber = null;
    if (orderType === 'dineIn') {
      if (!tableNumber) {
        return res.status(400).json({
          success: false,
          message: 'Table number required for dine-in orders'
        });
      }
      
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
      
      // Reserve the table
      table.isReserved = true;
      table.reservedBy = {
        customerName: customerInfo.name,
        phoneNumber: customerInfo.phoneNumber,
        numberOfMembers: customerInfo.numberOfMembers || 1
      };
      await table.save();
      
      reservedTableNumber = tableNumber;
    }
    
    // Create order
    const orderId = generateOrderId();
    const newOrder = await Order.create({
      orderId,
      items: orderItems,
      totalPrice,
      orderType,
      status: 'pending',
      tableNumber: reservedTableNumber,
      customerInfo,
      cookingInstructions: cookingInstructions || '',
      totalPreparationTime
    });
    
    // Update menu item stock
    for (const item of items) {
      await Menu.findByIdAndUpdate(
        item.menuItem,
        { $inc: { stock: -item.quantity } }
      );
    }
    
    // Assign chef automatically
    const assignedChef = await assignChefToOrder(newOrder._id);
    
    // Populate order data
    const populatedOrder = await Order.findById(newOrder._id)
      .populate('items.menuItem')
      .populate('chefAssigned', 'name');
    
    res.status(201).json({
      success: true,
      data: populatedOrder,
      message: assignedChef 
        ? `Order created and assigned to ${assignedChef.name}` 
        : 'Order created but no chef available for assignment'
    });
  } catch (error) {
    console.error('Order creation error:', error);
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
    
    const oldStatus = order.status;
    order.status = status;
    
    // Handle status transitions
    if (status === 'processing' && oldStatus === 'pending') {
      order.processingStartTime = new Date();
    }
    
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
    
    // Unreserve table when order is served (dine-in)
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
      data: order,
      message: `Order status updated to ${status}`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete order
// @route   DELETE /api/orders/:id
exports.deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    // Release chef if assigned
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
    
    // Unreserve table if dine-in
    if (order.orderType === 'dineIn' && order.tableNumber) {
      const table = await Table.findOne({ tableNumber: order.tableNumber });
      if (table && table.isReserved) {
        table.isReserved = false;
        table.reservedBy = {};
        await table.save();
      }
    }
    
    // Restore menu item stock
    for (const item of order.items) {
      await Menu.findByIdAndUpdate(
        item.menuItem,
        { $inc: { stock: item.quantity } }
      );
    }
    
    await order.deleteOne();
    
    res.json({ 
      success: true, 
      message: 'Order deleted successfully',
      data: order
    });
  } catch (error) {
    next(error);
  }
};
