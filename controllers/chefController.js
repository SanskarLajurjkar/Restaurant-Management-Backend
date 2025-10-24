// controllers/chefController.js
const Chef = require('../models/Chef');
const Order = require('../models/Order');

// @desc    Get all chefs
// @route   GET /api/chefs
exports.getAllChefs = async (req, res, next) => {
  try {
    const chefs = await Chef.find()
      .populate('assignedOrders')
      .sort({ name: 1 });
    
    res.json({ 
      success: true, 
      count: chefs.length,
      data: chefs 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single chef
// @route   GET /api/chefs/:id
exports.getChefById = async (req, res, next) => {
  try {
    const chef = await Chef.findById(req.params.id).populate('assignedOrders');
    
    if (!chef) {
      return res.status(404).json({ 
        success: false, 
        message: 'Chef not found' 
      });
    }
    
    res.json({ 
      success: true, 
      data: chef 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new chef
// @route   POST /api/chefs
exports.createChef = async (req, res, next) => {
  try {
    const { name } = req.body;
    
    const chef = await Chef.create({
      name,
      currentOrdersCount: 0,
      assignedOrders: []
    });
    
    res.status(201).json({ 
      success: true, 
      data: chef 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update chef
// @route   PUT /api/chefs/:id
exports.updateChef = async (req, res, next) => {
  try {
    const chef = await Chef.findByIdAndUpdate(
      req.params.id,
      { name: req.body.name },
      { 
        new: true, 
        runValidators: true 
      }
    );
    
    if (!chef) {
      return res.status(404).json({ 
        success: false, 
        message: 'Chef not found' 
      });
    }
    
    res.json({ 
      success: true, 
      data: chef 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete chef
// @route   DELETE /api/chefs/:id
exports.deleteChef = async (req, res, next) => {
  try {
    const chef = await Chef.findById(req.params.id);
    
    if (!chef) {
      return res.status(404).json({ 
        success: false, 
        message: 'Chef not found' 
      });
    }
    
    // Reassign orders to other chefs
    if (chef.assignedOrders.length > 0) {
      const otherChefs = await Chef.find({ _id: { $ne: chef._id } });
      
      if (otherChefs.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cannot delete the last chef with assigned orders' 
        });
      }
      
      for (const orderId of chef.assignedOrders) {
        const targetChef = otherChefs.reduce((min, curr) => 
          curr.currentOrdersCount < min.currentOrdersCount ? curr : min
        );
        
        await Order.findByIdAndUpdate(orderId, { chefAssigned: targetChef._id });
        targetChef.currentOrdersCount += 1;
        targetChef.assignedOrders.push(orderId);
        await targetChef.save();
      }
    }
    
    await chef.deleteOne();
    
    res.json({ 
      success: true, 
      message: 'Chef deleted successfully' 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manually assign order to chef
// @route   POST /api/chefs/assign-order
exports.assignOrderToChef = async (req, res, next) => {
  try {
    const { orderId, chefId } = req.body;
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: 'Order not found' 
      });
    }
    
    const chef = await Chef.findById(chefId);
    if (!chef) {
      return res.status(404).json({ 
        success: false, 
        message: 'Chef not found' 
      });
    }
    
    // Remove from old chef if assigned
    if (order.chefAssigned) {
      const oldChef = await Chef.findById(order.chefAssigned);
      if (oldChef) {
        oldChef.currentOrdersCount = Math.max(0, oldChef.currentOrdersCount - 1);
        oldChef.assignedOrders = oldChef.assignedOrders.filter(
          id => id.toString() !== orderId
        );
        await oldChef.save();
      }
    }
    
    // Assign to new chef
    order.chefAssigned = chef._id;
    await order.save();
    
    chef.currentOrdersCount += 1;
    chef.assignedOrders.push(order._id);
    await chef.save();
    
    res.json({ 
      success: true, 
      message: 'Order assigned to chef successfully',
      data: { order, chef }
    });
  } catch (error) {
    next(error);
  }
};