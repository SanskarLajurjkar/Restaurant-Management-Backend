// controllers/menuController.js
const Menu = require('../models/Menu');

// @desc    Get all menu items
// @route   GET /api/menu
exports.getAllMenuItems = async (req, res, next) => {
  try {
    const menuItems = await Menu.find().sort({ category: 1, name: 1 });
    
    res.json({ 
      success: true, 
      count: menuItems.length,
      data: menuItems 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get menu items by category with pagination
// @route   GET /api/menu/category/:category
exports.getMenuByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const { search, page = 1, limit = 10 } = req.query;
    
    let query = { category };
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    const skip = (page - 1) * limit;
    const menuItems = await Menu.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ name: 1 });
    
    const total = await Menu.countDocuments(query);
    
    res.json({ 
      success: true,
      data: menuItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + menuItems.length < total
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all categories
// @route   GET /api/menu/categories/all
exports.getAllCategories = async (req, res, next) => {
  try {
    const categories = await Menu.distinct('category');
    
    res.json({ 
      success: true, 
      count: categories.length,
      data: categories 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single menu item
// @route   GET /api/menu/:id
exports.getMenuItemById = async (req, res, next) => {
  try {
    const menuItem = await Menu.findById(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }
    
    res.json({ 
      success: true, 
      data: menuItem 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new menu item
// @route   POST /api/menu
exports.createMenuItem = async (req, res, next) => {
  try {
    const menuItem = await Menu.create(req.body);
    
    res.status(201).json({ 
      success: true, 
      data: menuItem 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update menu item
// @route   PUT /api/menu/:id
exports.updateMenuItem = async (req, res, next) => {
  try {
    const menuItem = await Menu.findByIdAndUpdate(
      req.params.id,
      req.body,
      { 
        new: true, 
        runValidators: true 
      }
    );
    
    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }
    
    res.json({ 
      success: true, 
      data: menuItem 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete menu item
// @route   DELETE /api/menu/:id
exports.deleteMenuItem = async (req, res, next) => {
  try {
    const menuItem = await Menu.findByIdAndDelete(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Menu item deleted successfully',
      data: menuItem
    });
  } catch (error) {
    next(error);
  }
};