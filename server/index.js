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

// Daily Pocket Money Payout Cron (admin-controlled) — kept commented out on purpose.
// Payouts are released ONLY when admin approves via /api/pocket-money/admin/release/:id
const { runPocketMoneyPayouts } = require('./controllers/pocketMoneyController');

// 🔔 DAILY POCKET MONEY REMINDER — runs every morning at 8:00 AM
// Sends push notification to all users with a pocket money payout due today.
// Works even when the app is in background/killed because it's server-side push (Expo API).
cron.schedule("0 8 * * *", async () => {
  console.log("[PocketMoneyReminder] Running daily pocket money notification cron...");
  try {
    const PocketMoney = require('./models/PocketMoney');
    const { sendNotification } = require('./services/notificationHelper');
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Find active plans whose nextPayoutDate is today or overdue
    const eligiblePlans = await PocketMoney.find({
      status: 'active',
      nextPayoutDate: { $lte: new Date() },
    });

    let notifCount = 0;
    for (const plan of eligiblePlans) {
      try {
        const freqLabel = plan.frequency === 'daily' ? 'daily'
          : plan.frequency === 'every_2_days' ? 'every 2 days' : 'weekly';
        const remaining = plan.remainingAmount || 0;
        const payoutAmt = plan.payoutAmount || 0;

        await sendNotification({
          userId: plan.userId,
          title: '💰 Pocket Money Ready to Claim!',
          description: `Your ${freqLabel} pocket money payout of ₹${payoutAmt} is ready! Open the Pocket Money section and request your payout. Remaining pot: ₹${remaining}.`,
          type: 'pocket_money_payout',
          metadata: { pocketMoneyId: plan._id, amount: payoutAmt },
          pushData: { screen: 'PocketMoney' },
        });
        notifCount++;
      } catch (err) {
        console.error(`[PocketMoneyReminder] Failed to notify userId ${plan.userId}:`, err.message);
      }
    }
    console.log(`[PocketMoneyReminder] Sent ${notifCount} pocket money reminder notifications.`);
  } catch (error) {
    console.error("[PocketMoneyReminder] Cron error:", error);
  }
});


// Due Reminder & Penalty Cron Job (runs daily at 8:00 AM)
const calcNextWeeklyDueDate = (joinedAt, weekIndex) => {
  const base = new Date(joinedAt);
  const day = base.getDay();
  const daysToSunday = day === 0 ? 0 : 7 - day;
  const firstSunday = new Date(base.getTime() + daysToSunday * 24 * 60 * 60 * 1000);
  firstSunday.setHours(12, 0, 0, 0);
  const targetDueDate = new Date(firstSunday.getTime() + (weekIndex) * 7 * 24 * 60 * 60 * 1000);
  return targetDueDate;
};

cron.schedule("0 8 * * *", async () => {
  console.log("Running Due Reminder & Penalty Cron Job...");
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
      
      // 2. Regular Reminders
      const baseAmt = isWeekly ? (member.chitId.weeklyAmount || 200) : (member.chitId.monthlyAmount || 1000);
      const unitLabel = isWeekly ? 'weekly' : 'monthly';
      const screenName = isWeekly ? 'MonthlyDue' : 'MonthlyDue'; // Unified navigation
      
      if (diffDays >= 0 && diffDays <= 3) {
        const dueDateStr = nextDue.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        
        await sendNotification({
          userId: member.userId._id,
          title: `📅 ${unitLabel.toUpperCase()} Due Reminder`,
          description: `Your ${unitLabel} installment for "${member.chitId.name}" is due on ${dueDateStr}. Please complete your payment.`,
          type: 'due_reminder',
          metadata: { chitId: member.chitId._id, memberId: member._id, dueDate: nextDue },
          pushData: { screen: screenName },
        });
        reminderCount++;
      }

      if (diffDays === 2) {
        await sendNotification({
          userId: member.userId._id,
          title: `⚠️ Payment Due in 2 Days`,
          description: `Your ${unitLabel} due of ₹${baseAmt} for "${member.chitId.name}" is due in 2 days.`,
          type: 'due_reminder_2_days',
          metadata: { chitId: member.chitId._id, memberId: member._id, dueDate: nextDue },
          pushData: { screen: screenName },
        });
      }

      if (diffDays === 1) {
        await sendNotification({
          userId: member.userId._id,
          title: `🚨 Payment Due Tomorrow`,
          description: `Your ${unitLabel} due of ₹${baseAmt} for "${member.chitId.name}" is due tomorrow. Please pay to avoid late fees.`,
          type: 'due_reminder_1_day',
          metadata: { chitId: member.chitId._id, memberId: member._id, dueDate: nextDue },
          pushData: { screen: screenName },
        });
      }
    }
    console.log(`Due Reminder & Penalty Cron Job Finished: Sent reminders and checked penalties.`);
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
// Serve static files (web reset-password page)
app.use(express.static(require('path').join(__dirname, 'public')));
// FIX 1: Increase JSON body limit to 50mb to handle base64 image uploads for KYC
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Web reset-password page route — serves the HTML file
app.get('/reset-password', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'public', 'reset-password.html'));
});

// Web referral landing page route
app.get('/ref/:code', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'public', 'ref-landing.html'));
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


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});