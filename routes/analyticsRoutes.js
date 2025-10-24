// routes/analyticsRoutes.js
const express = require('express');
const router = express.Router();
const {
  getDashboardMetrics,
  getOrdersSummary,
  getGraphData,
  getOrderProcessing
} = require('../controllers/analyticsController');

router.get('/dashboard', getDashboardMetrics);
router.get('/orders-summary', getOrdersSummary);
router.get('/graph', getGraphData);
router.get('/order-processing', getOrderProcessing);

module.exports = router;