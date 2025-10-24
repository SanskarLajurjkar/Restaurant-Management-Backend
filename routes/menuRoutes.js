// routes/menuRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllMenuItems,
  getMenuByCategory,
  getAllCategories,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem
} = require('../controllers/menuController');

router.get('/', getAllMenuItems);
router.get('/categories/all', getAllCategories);
router.get('/category/:category', getMenuByCategory);
router.get('/:id', getMenuItemById);
router.post('/', createMenuItem);
router.put('/:id', updateMenuItem);
router.delete('/:id', deleteMenuItem);

module.exports = router;