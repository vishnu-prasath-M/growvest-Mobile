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
const ChitMember = require('./models/ChitMember');
const Chit = require('./models/Chit');
const { sendNotification } = require('./services/notificationHelper');

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

// Due Reminder Cron Job (runs daily at 8:00 AM)
cron.schedule("0 8 * * *", async () => {
  console.log("Running Due Reminder Cron Job...");
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find all active members with upcoming dues within 3 days
    const members = await ChitMember.find({ status: 'active' })
      .populate('chitId', 'name monthlyAmount')
      .populate('userId', '_id name username');
    
    let reminderCount = 0;
    for (const member of members) {
      if (!member.chitId || !member.userId) continue;
      
      // Calculate next due date
      const joinedDate = new Date(member.joinedAt);
      const nextDue = new Date(joinedDate);
      nextDue.setMonth(joinedDate.getMonth() + member.currentMonth);
      nextDue.setDate(1);
      nextDue.setHours(0, 0, 0, 0);
      
      // Check if chit is closed
      if (['closed', 'completed', 'archived'].includes(member.chitId.status)) continue;
      
      // Check if member has completed all installments
      if (member.currentMonth >= member.chitId.duration) continue;
      
      const diffTime = nextDue.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Send reminder if due within 3 days or overdue
      if (diffDays >= 0 && diffDays <= 3) {
        const dueDateStr = nextDue.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        
        // Send unified notification (DB + Push) using the same implementation
        await sendNotification({
          userId: member.userId._id,
          title: '📅 Monthly Due Reminder',
          description: `Your monthly installment for "${member.chitId.name}" is due on ${dueDateStr}. Please complete your payment before the due date.`,
          type: 'due_reminder',
          metadata: { chitId: member.chitId._id, memberId: member._id, dueDate: nextDue },
          pushData: { screen: 'MonthlyDue' },
        });
        
        reminderCount++;
      }
    }
    console.log(`Due Reminder Cron Job Finished: Sent ${reminderCount} reminders.`);
  } catch (error) {
    console.error("Due Reminder Cron Job Error:", error);
  }
});
const investmentRoutes = require('./routes/investmentRoutes');
const chitAdminRoutes = require('./routes/chitAdminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const kycRoutes = require('./routes/kycRoutes');

const app = express();
app.use(cors());
// FIX 1: Increase JSON body limit to 50mb to handle base64 image uploads for KYC
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://vishnuprasath:8925699005@grow-clust.bynj9dx.mongodb.net/growvest?appName=Grow-Clust';

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
app.use('/api/notifications', notificationRoutes);
app.use('/api/kyc', kycRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});