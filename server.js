// server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { checkAndCompleteOrders, initializeChefs } = require('./utils/orderProcessing');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware to check order completion on each request
app.use(async (req, res, next) => {
  // Run order completion check in background (don't block requests)
  checkAndCompleteOrders().catch(err => 
    console.error('Background order check error:', err)
  );
  next();
});

// Import Routes
const menuRoutes = require('./routes/menuRoutes');
const orderRoutes = require('./routes/orderRoutes');
const tableRoutes = require('./routes/tableRoutes');
const chefRoutes = require('./routes/chefRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

// Use Routes
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/chefs', chefRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health Check
app.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: 'Restaurant Management API is running!',
    version: '1.0.0'
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// Error Handling Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Start server and initialize system
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Initialize default chefs if needed
  await initializeChefs();
  
  // Set up periodic order completion check (every 30 seconds)
  setInterval(() => {
    checkAndCompleteOrders().catch(err => 
      console.error('Periodic order check error:', err)
    );
  }, 30000);
  
  console.log(' Order processing system initialized');
});