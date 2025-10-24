// models/Table.js
const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  tableNumber: {
    type: Number,
    required: true,
    unique: true
  },
  capacity: {
    type: Number,
    enum: [2, 4, 6, 8],
    required: true
  },
  isReserved: {
    type: Boolean,
    default: false
  },
  tableName: {
    type: String,
    default: ''
  },
  reservedBy: {
    customerName: String,
    phoneNumber: String,
    numberOfMembers: Number
  }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Table', tableSchema);