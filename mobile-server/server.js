require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const investmentRoutes = require('./routes/investmentRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/mobile/auth', authRoutes);
app.use('/api/mobile/dashboard', dashboardRoutes);
app.use('/api/mobile/investments', investmentRoutes);
app.use('/api/mobile/transactions', transactionRoutes);
app.use('/api/mobile/withdrawals', withdrawalRoutes);

// Health check
app.get('/api/mobile/health', (req, res) => {
  res.json({ status: 'ok', message: 'Mobile server is running' });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Mobile server running on port ${PORT}`);
});