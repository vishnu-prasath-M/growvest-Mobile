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

// Feature 7: Daily Interest Cron Setup (12:00 AM IST)
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
}, { timezone: "Asia/Kolkata" });

// 📢 Daily notifications (pocket money payout, morning tip, evening engagement)
// are handled exclusively by GitHub Actions (.github/workflows/daily-notifications.yml)
// which calls POST /api/cron/daily-notifications?type=<pocket_money|morning_tip|evening>
// This avoids duplicate notifications from server-side crons on the UTC Render server.


// Due Reminder & Penalty Cron Job (runs daily at 8:45 AM IST)
const calcNextWeeklyDueDate = (joinedAt, weekIndex) => {
  const base = new Date(joinedAt);
  const day = base.getDay();
  const daysToSunday = day === 0 ? 0 : 7 - day;
  const firstSunday = new Date(base.getTime() + daysToSunday * 24 * 60 * 60 * 1000);
  firstSunday.setHours(12, 0, 0, 0);
  const targetDueDate = new Date(firstSunday.getTime() + (weekIndex) * 7 * 24 * 60 * 60 * 1000);
  return targetDueDate;
};

cron.schedule("45 8 * * *", async () => {
  console.log("Running Due Reminder & Penalty Cron Job (8:45 AM IST)...");
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find all active members
    const members = await ChitMember.find({ status: 'active' })
      .populate('chitId', 'name monthlyAmount weeklyAmount totalWeeks totalContribution status isWeekly')
      .populate('userId', '_id name username email');
    
    let reminderCount = 0;
    for (const member of members) {
      if (!member.chitId || !member.userId) continue;
      if (['closed', 'completed', 'archived'].includes(member.chitId.status)) continue;

      const isWeekly = member.chitId.isWeekly || false;
      const currentUnit = isWeekly ? member.currentWeek : member.currentMonth;
      const totalUnits = isWeekly ? (member.chitId.totalWeeks || member.chitId.duration) : member.chitId.duration;
      
      if (currentUnit >= totalUnits) continue; 
      
      const dueUnitIndex = currentUnit + 1;
      
      // Calculate next due date
      const nextDue = isWeekly
        ? calcNextWeeklyDueDate(member.joinedAt, currentUnit)
        : calcNextDueDate(member.joinedAt, member.currentMonth);
        
      const diffTime = nextDue.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // 1. Check for overdue and apply penalty
      if (diffDays < 0) {
        const ChitPayment = require('./models/ChitPayment');
        const Transaction = require('./models/Transaction');
        
        const paidPayment = await ChitPayment.findOne({
          memberId: member._id,
          month: dueUnitIndex,
          status: 'paid'
        });
        
        if (!paidPayment) {
          let paymentRecord = await ChitPayment.findOne({
            memberId: member._id,
            month: dueUnitIndex
          });
          
          const baseAmount = isWeekly ? (member.chitId.weeklyAmount || 200) : (member.chitId.monthlyAmount || 1000);
          const penaltyAmount = isWeekly ? (baseAmount * 0.05) : 0; 
          
          if (penaltyAmount > 0) {
            if (!paymentRecord) {
              paymentRecord = new ChitPayment({
                chitId: member.chitId._id,
                userId: member.userId._id,
                memberId: member._id,
                month: dueUnitIndex,
                amount: baseAmount + penaltyAmount,
                lateFee: penaltyAmount,
                status: 'pending',
                dueDate: nextDue
              });
              await paymentRecord.save();
              
              member.penaltiesUnpaid = (member.penaltiesUnpaid || 0) + penaltyAmount;
              member.unpaidWeeks = (member.unpaidWeeks || 0) + 1;
              await member.save();
              
              const penaltyTx = new Transaction({
                userId: member.userId._id,
                userEmail: member.userId.email || 'no-email@growvest.com',
                type: 'chit_penalty',
                amount: penaltyAmount,
                status: 'approved',
                referenceId: paymentRecord._id,
                referenceType: 'ChitPayment',
                description: `Overdue Penalty - ${member.chitId.name} Week ${dueUnitIndex}`,
              });
              await penaltyTx.save();
              
              await sendNotification({
                userId: member.userId._id,
                title: '🔥 Payment Overdue & Penalty Applied',
                description: `Your weekly installment for "${member.chitId.name}" is overdue. A ₹${penaltyAmount} penalty has been applied.`,
                type: 'due_overdue',
                metadata: { chitId: member.chitId._id, memberId: member._id, dueDate: nextDue },
                pushData: { screen: 'MonthlyDue' },
              });
            } else if (paymentRecord.lateFee === 0) {
              paymentRecord.lateFee = penaltyAmount;
              paymentRecord.amount += penaltyAmount;
              await paymentRecord.save();
              
              member.penaltiesUnpaid = (member.penaltiesUnpaid || 0) + penaltyAmount;
              await member.save();
              
              const penaltyTx = new Transaction({
                userId: member.userId._id,
                userEmail: member.userId.email || 'no-email@growvest.com',
                type: 'chit_penalty',
                amount: penaltyAmount,
                status: 'approved',
                referenceId: paymentRecord._id,
                referenceType: 'ChitPayment',
                description: `Overdue Penalty - ${member.chitId.name} Week ${dueUnitIndex}`,
              });
              await penaltyTx.save();
              
              await sendNotification({
                userId: member.userId._id,
                title: '🔥 Payment Overdue & Penalty Applied',
                description: `Your weekly installment for "${member.chitId.name}" is overdue. A ₹${penaltyAmount} penalty has been applied.`,
                type: 'due_overdue',
                metadata: { chitId: member.chitId._id, memberId: member._id, dueDate: nextDue },
                pushData: { screen: 'MonthlyDue' },
              });
            }
          }
        }
      }
      
      // 2. Regular Reminders for Last 4 Days
      const baseAmt = isWeekly ? (member.chitId.weeklyAmount || 200) : (member.chitId.monthlyAmount || 1000);
      const unitLabel = isWeekly ? 'weekly' : 'monthly';
      const screenName = 'MonthlyDue';
      
      if (diffDays >= 0 && diffDays <= 4) {
        const dueDateStr = nextDue.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const daysText = diffDays === 0 ? 'today' : diffDays === 1 ? 'tomorrow' : `in ${diffDays} days`;
        
        await sendNotification({
          userId: member.userId._id,
          title: `⏳ Chit Due Reminder (${daysText})`,
          description: `Your ${unitLabel} installment of ₹${baseAmt} for "${member.chitId.name}" is due ${daysText} (on ${dueDateStr}). Please complete your payment.`,
          type: 'due_reminder',
          metadata: { chitId: member.chitId._id, memberId: member._id, dueDate: nextDue },
          pushData: { screen: screenName },
        });
        reminderCount++;
      }
    }
    console.log(`Due Reminder & Penalty Cron Job Finished: Sent ${reminderCount} reminders and checked penalties.`);
  } catch (error) {
    console.error("Due Reminder Cron Job Error:", error);
  }
}, { timezone: "Asia/Kolkata" });

// Morning tip (9:15 AM IST) and Evening engagement (6:00 PM IST) are
// triggered by GitHub Actions workflows — see .github/workflows/daily-notifications.yml
const investmentRoutes = require('./routes/investmentRoutes');
const chitAdminRoutes = require('./routes/chitAdminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const kycRoutes = require('./routes/kycRoutes');

const app = express();
app.use(cors());
// Serve static files (web reset-password page)
app.use(express.static(require('path').join(__dirname, 'public')));
// Increase JSON and urlencoded body limit to 150mb for APK uploads and image data
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ limit: '150mb', extended: true }));

// Health Check & Render Keep-Alive Endpoint
app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date() });
});

// Web reset-password page route — serves the HTML file
app.get('/reset-password', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'public', 'reset-password.html'));
});

// Web referral landing page route
app.get(['/ref', '/ref/', '/ref/:code'], (req, res) => {
  res.sendFile(require('path').join(__dirname, 'public', 'ref-landing.html'));
});

// Android APK Download Route
const apkController = require('./controllers/apkController');
app.get('/downloads/growvest-latest.apk', apkController.downloadActiveAPK);

// Android App Links Digital Asset Links Route
app.get('/.well-known/assetlinks.json', (req, res) => {
  const path = require('path');
  const assetPath = path.join(__dirname, 'public', '.well-known', 'assetlinks.json');
  res.setHeader('Content-Type', 'application/json');
  return res.sendFile(assetPath);
});

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://vishnuprasath:8925699005@grow-clust.bynj9dx.mongodb.net/growvest?appName=Grow-Clust';

// Fix for Node.js DNS SRV lookup issues on Windows
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log(`Connected to MongoDB: ${mongoose.connection.host}`);
    
    // Initialize default settings (UPI ID, etc.)
    await initializeSettings();

    // Ensure obsolete unique indexes are cleaned up
    try {
      const db = mongoose.connection.db;
      const chitpaymentsCol = db.collection('chitpayments');
      const pIndexes = await chitpaymentsCol.indexes();
      for (const idx of pIndexes) {
        if (idx.name === 'chitId_1_userId_1_month_1') {
          await chitpaymentsCol.dropIndex(idx.name);
          console.log('[DB] Dropped legacy unique index chitId_1_userId_1_month_1');
        }
      }
    } catch (idxErr) {
      // Non-fatal
    }

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

const paymentRoutes = require('./routes/paymentRoutes');
const pocketMoneyRoutes = require('./routes/pocketMoneyRoutes');
const referralRoutes = require('./routes/referralRoutes');
const sipRoutes = require('./routes/sipRoutes');
const SIP = require('./models/SIP');
const SIPContribution = require('./models/SIPContribution');

const cronRoutes = require('./routes/cronRoutes');

// Daily SIP Reminder Cron (runs daily at 8:30 AM IST)
cron.schedule("30 8 * * *", async () => {
  console.log("Running Daily SIP Due Reminder Cron Job (8:30 AM IST)...");
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeSIPs = await SIP.find({ status: 'active' });
    let reminderCount = 0;

    for (const sip of activeSIPs) {
      if (!sip.nextContributionDate) continue;
      const nextDue = new Date(sip.nextContributionDate);
      nextDue.setHours(0, 0, 0, 0);

      const diffTime = nextDue.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const freq = sip.frequency || 'monthly';
      const formattedDate = nextDue.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

      let shouldSend = false;
      let title = '';
      let description = '';

      if (freq === 'daily') {
        if (diffDays === 0) {
          shouldSend = true;
          title = '📅 Daily SIP Due Today!';
          description = `Your daily SIP contribution of ₹${sip.amount.toLocaleString('en-IN')} for ${sip.sipId} is due today.`;
        }
      } else if (freq === 'weekly') {
        if (diffDays === 0) {
          shouldSend = true;
          title = '📅 Weekly SIP Due Today!';
          description = `Your weekly SIP contribution of ₹${sip.amount.toLocaleString('en-IN')} for ${sip.sipId} is due today.`;
        } else if (diffDays === 1) {
          shouldSend = true;
          title = '📅 Weekly SIP Due Tomorrow';
          description = `Your weekly SIP contribution of ₹${sip.amount.toLocaleString('en-IN')} for ${sip.sipId} is due tomorrow (${formattedDate}).`;
        }
      } else {
        // Monthly
        if ([0, 1, 2].includes(diffDays)) {
          const daysText = diffDays === 0 ? 'today' : diffDays === 1 ? 'tomorrow' : 'in 2 days';
          shouldSend = true;
          title = `📅 Monthly SIP Due (${daysText})`;
          description = `Your monthly SIP contribution of ₹${sip.amount.toLocaleString('en-IN')} for ${sip.sipId} is due ${daysText} (${formattedDate}).`;
        }
      }

      if (shouldSend) {
        await sendNotification({
          userId: sip.userId,
          title,
          description,
          type: 'general',
          pushData: { screen: 'SIPDetails', sipId: sip._id.toString() },
        });
        reminderCount++;
      }
    }
    console.log(`SIP Cron Finished: Sent ${reminderCount} SIP reminders.`);
  } catch (error) {
    console.error("SIP Reminder Cron Error:", error);
  }
}, { timezone: "Asia/Kolkata" });

app.use('/api/investments', investmentRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/mobile/auth', authRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/chits', chitAdminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/pocket-money', pocketMoneyRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/wallet', referralRoutes);
app.use('/api/sip', sipRoutes);
app.use('/api/cron', cronRoutes);

// Admin manual trigger — calls the same cron functions as GitHub Actions
const { protect, admin } = require('./middleware/authMiddleware');
const cronService = require('./services/cronService');

app.post('/api/admin/trigger-daily-notifications', protect, admin, async (req, res) => {
  try {
    await cronService.sendDailyPocketMoneyNotifications();
    await cronService.sendMorningFinancialTip();
    await cronService.sendEveningEngagementNotification();
    res.json({ message: 'All daily notifications triggered and dispatched successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error triggering notifications', error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});