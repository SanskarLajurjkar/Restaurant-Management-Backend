// routes/tableRoutes.js
const express = require('express');
const router = express.Router();
const { validateTable } = require('../middleware/validationsRequest');
const {
  getAllTables,
  getAvailableTablesByCapacity,
  getTableById,
  createTable,
  updateTable,
  reserveTable,
  unreserveTable,
  deleteTable
} = require('../controllers/tableController');

router.get('/', getAllTables);
router.get('/available/:capacity', getAvailableTablesByCapacity);
router.get('/:id', getTableById);
router.post('/', validateTable, createTable);
router.put('/:id', updateTable);
router.put('/:id/reserve', reserveTable);
router.put('/:id/unreserve', unreserveTable);
router.delete('/:id', deleteTable);

module.exports = router;