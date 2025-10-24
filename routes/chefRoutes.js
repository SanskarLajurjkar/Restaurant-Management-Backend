// routes/chefRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllChefs,
  getChefById,
  createChef,
  updateChef,
  deleteChef,
  assignOrderToChef
} = require('../controllers/chefController');

router.get('/', getAllChefs);
router.get('/:id', getChefById);
router.post('/', createChef);
router.put('/:id', updateChef);
router.delete('/:id', deleteChef);
router.post('/assign-order', assignOrderToChef);

module.exports = router;