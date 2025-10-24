// models/Order.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    // Remove the index: true if you're using schema.index()
  },
  items: [{
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Menu',
      required: true
    },
    name: String,
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: Number,
    preparationTime: Number
  }],
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  orderType: {
    type: String,
    enum: ['dineIn', 'takeaway'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'done', 'served'],
    default: 'pending'
  },
  tableNumber: {
    type: Number,
    default: null
  },
  customerInfo: {
    name: {
      type: String,
      required: true
    },
    phoneNumber: {
      type: String,
      required: true
    },
    numberOfMembers: Number,
    address: String,
  },
  cookingInstructions: {
    type: String,
    default: ''
  },
  chefAssigned: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chef',
    default: null
  },
  processingStartTime: {
    type: Date,
    default: null
  },
  totalPreparationTime: {
    type: Number,
    default: 0
  }
}, { 
  timestamps: true 
});

// Use only one indexing method
orderSchema.index({ orderId: 1 });

module.exports = mongoose.model('Order', orderSchema);