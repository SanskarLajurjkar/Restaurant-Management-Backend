const Table = require('../models/Table');

// @desc    Get all tables
// @route   GET /api/tables
exports.getAllTables = async (req, res, next) => {
  try {
    const tables = await Table.find().sort({ tableNumber: 1 });
    
    res.json({ 
      success: true, 
      count: tables.length,
      data: tables 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get available tables by capacity
// @route   GET /api/tables/available/:capacity
exports.getAvailableTablesByCapacity = async (req, res, next) => {
  try {
    const capacity = parseInt(req.params.capacity);
    const tables = await Table.find({ 
      capacity: { $gte: capacity },
      isReserved: false 
    }).sort({ capacity: 1, tableNumber: 1 });
    
    res.json({ 
      success: true, 
      count: tables.length,
      data: tables 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single table
// @route   GET /api/tables/:id
exports.getTableById = async (req, res, next) => {
  try {
    const table = await Table.findById(req.params.id);
    
    if (!table) {
      return res.status(404).json({ 
        success: false, 
        message: 'Table not found' 
      });
    }
    
    res.json({ 
      success: true, 
      data: table 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new table
// @route   POST /api/tables
exports.createTable = async (req, res, next) => {
  try {
    const { capacity, tableName } = req.body;
    
    // Get the highest table number and add 1
    const lastTable = await Table.findOne().sort({ tableNumber: -1 });
    const tableNumber = lastTable ? lastTable.tableNumber + 1 : 1;
    
    const table = await Table.create({
      tableNumber,
      capacity,
      tableName: tableName || '',
      isReserved: false
    });
    
    res.status(201).json({ 
      success: true, 
      data: table 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update table
// @route   PUT /api/tables/:id
exports.updateTable = async (req, res, next) => {
  try {
    const table = await Table.findByIdAndUpdate(
      req.params.id,
      req.body,
      { 
        new: true, 
        runValidators: true 
      }
    );
    
    if (!table) {
      return res.status(404).json({ 
        success: false, 
        message: 'Table not found' 
      });
    }
    
    res.json({ 
      success: true, 
      data: table 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reserve table
// @route   PUT /api/tables/:id/reserve
exports.reserveTable = async (req, res, next) => {
  try {
    const { customerName, phoneNumber, numberOfMembers } = req.body;
    const table = await Table.findById(req.params.id);
    
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
    table.reservedBy = { customerName, phoneNumber, numberOfMembers };
    await table.save();
    
    res.json({ 
      success: true, 
      data: table 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unreserve table
// @route   PUT /api/tables/:id/unreserve
exports.unreserveTable = async (req, res, next) => {
  try {
    const table = await Table.findById(req.params.id);
    
    if (!table) {
      return res.status(404).json({ 
        success: false, 
        message: 'Table not found' 
      });
    }
    
    table.isReserved = false;
    table.reservedBy = {};
    await table.save();
    
    res.json({ 
      success: true, 
      data: table 
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete table and reshuffle numbering
// @route   DELETE /api/tables/:id
exports.deleteTable = async (req, res, next) => {
  try {
    const table = await Table.findById(req.params.id);
    
    if (!table) {
      return res.status(404).json({ 
        success: false, 
        message: 'Table not found' 
      });
    }
    
    if (table.isReserved) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete reserved table' 
      });
    }
    
    const deletedTableNumber = table.tableNumber;
    await table.deleteOne();
    
    // Reshuffle table numbers
    await Table.updateMany(
      { tableNumber: { $gt: deletedTableNumber } },
      { $inc: { tableNumber: -1 } }
    );
    
    const tables = await Table.find().sort({ tableNumber: 1 });
    
    res.json({ 
      success: true, 
      message: 'Table deleted and numbering reshuffled',
      data: tables
    });
  } catch (error) {
    next(error);
  }
};