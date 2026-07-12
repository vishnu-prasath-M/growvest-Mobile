require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
const User = require('./models/User');
const Investment = require('./models/Investment');
const { syncInvestmentInterest } = require('./controllers/userController');
const { initializeSettings } = require('./controllers/settingsController');
const { seedChits } = require('./utils/seedChits');

// Feature 7: Daily Interest Cron Setup (12:00 AM)
cron.schedule("0 0 * * *", async () => {
  console.log("Running Daily Interest Calculation Cron Job...");
  try {
    const investments = await Investment.find({ status: 'approved' });
    let count = 0;
    for (const inv of investments) {
      await syncInvestmentInterest(inv);
      count++;
    }
    console.log(`Cron Job Finished: Updated ${count} investments.`);
  } catch (error) {
    console.error("Cron Job Error:", error);
  }
});
const investmentRoutes = require('./routes/investmentRoutes');
const chitAdminRoutes = require('./routes/chitAdminRoutes');

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/zenvest-dummy';

// Fix for Node.js DNS SRV lookup issues on Windows
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log(`Connected to MongoDB: ${mongoose.connection.host}`);
    
    // Initialize default settings (UPI ID, etc.)
    await initializeSettings();

    // Seed default Chits
    await seedChits();

    // Seed Admin User
    try {
      const adminEmail = 'MohanRaj@235';
      const existingUser = await User.findOne({ email: adminEmail });
      
      if (existingUser) {
        if (existingUser.role !== 'admin') {
          existingUser.role = 'admin';
          await existingUser.save();
          console.log('Existing user updated to admin');
        }
      } else {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('Durga@11', salt);
        const admin = await User.create({
          name: 'Admin',
          username: 'admin',
          mobileNumber: '0000000000',
          email: adminEmail,
          password: hashedPassword,
          role: 'admin'
        });
        console.log(`Admin user seeded successfully with email: ${admin.email}`);
      }
    } catch (error) {
      console.error('Error seeding admin user:', error);
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

const authRoutes = require('./routes/authRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const userRoutes = require('./routes/userRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

app.use('/api/investments', investmentRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chits', chitAdminRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
