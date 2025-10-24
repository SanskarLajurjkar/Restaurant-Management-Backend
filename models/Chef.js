// models/Chef.js
const mongoose = require('mongoose');

const chefSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Chef name is required'],
    trim: true
  },
  currentOrdersCount: {
    type: Number,
    default: 0,
    min: 0
  },
  assignedOrders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }]
}, { 
  timestamps: true 
});

// Index for better query performance
chefSchema.index({ currentOrdersCount: 1 });

module.exports = mongoose.model('Chef', chefSchema);