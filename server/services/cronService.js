const cron = require('node-cron');
const PocketMoney = require('../models/PocketMoney');
const User = require('../models/User');
const Notification = require('../models/Notification');
const pushNotificationService = require('./pushNotificationService');

// Engagement Notification Messages Pool
const ENGAGEMENT_MESSAGES = [
  {
    title: '📈 Don\'t Let Your Savings Sleep!',
    body: 'Consistent daily & weekly savings build compounding wealth. Log in to check your active returns today!',
  },
  {
    title: '💰 Daily Pocket Money Reminder!',
    body: 'Start a 10-day Pocket Money plan today and enjoy guaranteed daily payouts!',
  },
  {
    title: '🏆 Exclusive Chit Fund Slots Opening!',
    body: 'High-yield chit fund slots are filling fast. Secure your slot before it closes!',
  },
  {
    title: '🎁 Claim Your Daily Growth & Coins!',
    body: 'Log in today to check your balance, claim referral coin rewards, and explore new high-yield plans!',
  },
  {
    title: '🔥 24% Annual Returns Available!',
    body: 'Explore our 1 Year Fixed Savings plan with up to 24% annual yield. Start investing smarter today!',
  },
];

// ─── 1. Send Daily Pocket Money Payout Notifications ─────────────────────────
const sendDailyPocketMoneyNotifications = async () => {
  console.log('[CronService] Running Daily Pocket Money Payout Notification check...');
  try {
    const activePlans = await PocketMoney.find({ status: 'active' }).populate('userId');

    for (const plan of activePlans) {
      if (!plan.userId) continue;

      const payoutAmount = (plan.investedAmount || 0) / 10;
      const title = '💰 Daily Pocket Money Ready!';
      const body = `Your daily payout of ₹${payoutAmount.toLocaleString('en-IN')} for ${plan.frequency?.toUpperCase()} plan is ready! Log in to claim.`;

      // 1. Create In-App Notification record
      await Notification.create({
        userId: plan.userId._id,
        title,
        description: body,
        type: 'pocket_money_payout',
        read: false,
      });

      // 2. Send Native Push Notification
      await pushNotificationService.sendToUser(plan.userId._id, {
        title,
        body,
        data: { screen: 'PocketMoney' },
      });
    }

    console.log(`[CronService] Processed Pocket Money notifications for ${activePlans.length} active plans.`);
  } catch (error) {
    console.error('[CronService] Error sending daily pocket money notifications:', error);
  }
};

// ─── 2. Send Daily Engaging Notifications to All Users ─────────────────────────
const sendDailyEngagingNotifications = async () => {
  console.log('[CronService] Running Daily Engaging Notification broadcast...');
  try {
    const users = await User.find({ fcmTokens: { $exists: true, $not: { $size: 0 } } });
    if (!users.length) {
      console.log('[CronService] No users with registered push tokens found.');
      return;
    }

    // Pick message based on day of year
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const selectedMsg = ENGAGEMENT_MESSAGES[dayOfYear % ENGAGEMENT_MESSAGES.length];

    console.log(`[CronService] Broadcasting message to ${users.length} users: "${selectedMsg.title}"`);

    for (const user of users) {
      // Create In-App Record
      await Notification.create({
        userId: user._id,
        title: selectedMsg.title,
        description: selectedMsg.body,
        type: 'system',
        read: false,
      });

      // Send Native Push Notification
      await pushNotificationService.sendToUser(user._id, {
        title: selectedMsg.title,
        body: selectedMsg.body,
        data: { screen: 'Home' },
      });
    }
  } catch (error) {
    console.error('[CronService] Error broadcasting daily engaging notifications:', error);
  }
};

// ─── Initialize Scheduled Cron Jobs ──────────────────────────────────────────
const initCronJobs = () => {
  console.log('[CronService] Initializing scheduled background cron jobs...');

  // Daily at 9:00 AM IST: Pocket Money Payout Notifications
  cron.schedule('0 9 * * *', () => {
    sendDailyPocketMoneyNotifications();
  });

  // Daily at 6:00 PM IST: Engaging Investment Reminder
  cron.schedule('0 18 * * *', () => {
    sendDailyEngagingNotifications();
  });
};

module.exports = {
  initCronJobs,
  sendDailyPocketMoneyNotifications,
  sendDailyEngagingNotifications,
};
