// routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const { validateOrder } = require('../middleware/validationsRequest');
const {
  getAllOrders,
  getOrderById,
  getOrdersByChef,
  createOrder,
  updateOrderStatus,
  deleteOrder
} = require('../controllers/orderController');

router.get('/', getAllOrders);
router.get('/chef/:chefId', getOrdersByChef);
router.get('/:id', getOrderById);
router.post('/', validateOrder, createOrder);
router.put('/:id/status', updateOrderStatus);
router.delete('/:id', deleteOrder);

module.exports = router;