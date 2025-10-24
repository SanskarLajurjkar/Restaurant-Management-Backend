// middleware/validateRequest.js
const validateOrder = (req, res, next) => {
  const { items, orderType, customerInfo } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Order must contain at least one item'
    });
  }

  if (!orderType || !['dineIn', 'takeaway'].includes(orderType)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid order type'
    });
  }

  if (!customerInfo || !customerInfo.name || !customerInfo.phoneNumber) {
    return res.status(400).json({
      success: false,
      message: 'Customer name and phone number are required'
    });
  }

  if (orderType === 'dineIn' && !req.body.tableNumber) {
    return res.status(400).json({
      success: false,
      message: 'Table number is required for dine-in orders'
    });
  }

  if (orderType === 'takeaway' && !customerInfo.address) {
    return res.status(400).json({
      success: false,
      message: 'Address is required for takeaway orders'
    });
  }

  next();
};

const validateTable = (req, res, next) => {
  const { capacity } = req.body;

  if (capacity && ![2, 4, 6, 8].includes(parseInt(capacity))) {
    return res.status(400).json({
      success: false,
      message: 'Table capacity must be 2, 4, 6, or 8'
    });
  }

  next();
};

module.exports = {
  validateOrder,
  validateTable
};