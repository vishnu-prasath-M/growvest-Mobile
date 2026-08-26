/**
 * CronService — All daily push notification functions.
 * Called exclusively by cronRoutes.js (GitHub Actions triggers) and
 * index.js for server-side scheduling.
 * 
 * Scheduling is handled in index.js with { timezone: "Asia/Kolkata" } to ensure
 * correct IST timing on the UTC Render server.
 * GitHub Actions provides an additional reliable trigger for each notification type.
 */

const PocketMoney = require('../models/PocketMoney');
const User = require('../models/User');
const Notification = require('../models/Notification');
const pushNotificationService = require('./pushNotificationService');

// ─── Morning Financial Tips (rotated daily) ───────────────────────────────────
const MORNING_TIPS = [
  {
    title: '🌱 Morning Wealth Booster',
    body: 'Consistent daily savings grow into wealth. Check your active plans in Growvest today!',
  },
  {
    title: '📈 The Magic of Compounding',
    body: 'Investing even a small amount regularly creates high compound returns. Explore Growvest investment plans!',
  },
  {
    title: '💡 Financial Freedom Goal',
    body: 'Build your emergency fund and wealth pot effortlessly with low-risk chit savings.',
  },
  {
    title: '☀️ Start Your Day Financially Smart',
    body: 'Good morning! Did you know Growvest chit savings can earn you up to 24% annual returns?',
  },
  {
    title: '🎯 Your Financial Goals Matter',
    body: 'Every rupee saved today is a step towards your dream. Check your portfolio growth in Growvest!',
  },
  {
    title: '💎 Invest Small, Earn Big',
    body: 'Start with as little as ₹500 per week in chit funds. Join thousands of smart investors on Growvest!',
  },
  {
    title: '🚀 Your Savings Are Growing!',
    body: 'Log in now to see how much your investments have grown. Growvest works even while you sleep!',
  },
];

// ─── Evening Engagement Messages (rotated daily) ──────────────────────────────
const EVENING_PROMOS = [
  {
    title: '🎁 Refer Friends & Earn Bonus Cash!',
    body: 'Share your Growvest referral link with family & friends to earn instant coin rewards!',
  },
  {
    title: '🏆 Auction Winnings & Chit Draws!',
    body: 'Keep your monthly chit dues current so you can participate in upcoming chit auction draws!',
  },
  {
    title: '✨ Smart Savings Reminder',
    body: 'End your day on a prosperous note by reviewing your growing financial portfolio on Growvest.',
  },
  {
    title: '💰 Don\'t Let Your Savings Sleep!',
    body: 'Consistent weekly savings build compounding wealth. Log in to check your active returns today!',
  },
  {
    title: '🔥 Exclusive Chit Fund Slots!',
    body: 'High-yield chit fund slots are filling fast. Secure your slot before it closes!',
  },
  {
    title: '🎉 Claim Your Rewards Tonight!',
    body: 'Log in now to check your balance, claim referral coin rewards, and explore new high-yield plans!',
  },
  {
    title: '📊 24% Annual Returns Available!',
    body: 'Explore our 1 Year Fixed Savings plan with up to 24% annual yield. Start investing smarter today!',
  },
];

// ─── Helper: Rotate message by day of year ────────────────────────────────────
const getDayOfYear = () => {
  const now = new Date();
  return Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
};

// ─── Helper: Send push + DB notification to a user ───────────────────────────
const sendUserNotification = async (userId, title, body, type, data = {}) => {
  try {
    await Notification.create({
      userId,
      title,
      description: body,
      type,
      read: false,
    });
  } catch (dbErr) {
    console.warn(`[CronService] DB notification save failed for user ${userId}:`, dbErr.message);
  }

  try {
    await pushNotificationService.sendToUser(userId, {
      title,
      body,
      data: { type, ...data },
    });
  } catch (pushErr) {
    console.warn(`[CronService] Push notification failed for user ${userId}:`, pushErr.message);
  }
};

// ─── 1. Pocket Money Payout Notification (8:30 AM IST) ───────────────────────
const sendDailyPocketMoneyNotifications = async () => {
  console.log('[CronService] Running Daily Pocket Money Payout Notification check...');
  try {
    const now = new Date();
    const activePlans = await PocketMoney.find({
      status: 'active',
      nextPayoutDate: { $lte: now },
    }).populate('userId');

    let count = 0;
    for (const plan of activePlans) {
      if (!plan.userId?._id) continue;

      const payoutAmount = plan.payoutAmount || Math.round((plan.investedAmount || 0) / 10);
      const freqLabel = plan.frequency === 'daily' ? 'daily'
        : plan.frequency === 'every_2_days' ? 'every 2 days' : 'weekly';

      const title = '☀️ Daily Pocket Money Ready to Claim!';
      const body = `Good morning! Your ${freqLabel} pocket money payout of ₹${payoutAmount.toLocaleString('en-IN')} is ready. Log in to claim it in the Pocket Money section.`;

      await sendUserNotification(
        plan.userId._id,
        title,
        body,
        'pocket_money_payout',
        { screen: 'PocketMoney', pocketMoneyId: plan._id.toString() }
      );
      count++;
    }

    console.log(`[CronService] Pocket Money notifications sent to ${count} active plan holders.`);
    return { sent: count };
  } catch (error) {
    console.error('[CronService] Error sending pocket money notifications:', error);
    throw error;
  }
};

// ─── 2. Morning Financial Growth Tip (9:15 AM IST) ────────────────────────────
const sendMorningFinancialTip = async () => {
  console.log('[CronService] Running Morning Financial Tip Broadcast...');
  try {
    const users = await User.find({ role: 'user' }).select('_id');
    if (!users.length) {
      console.log('[CronService] No users found for morning tip.');
      return { sent: 0 };
    }

    const dayIdx = getDayOfYear();
    const tip = MORNING_TIPS[dayIdx % MORNING_TIPS.length];

    console.log(`[CronService] Broadcasting morning tip to ${users.length} users: "${tip.title}"`);

    let count = 0;
    for (const user of users) {
      await sendUserNotification(
        user._id,
        tip.title,
        tip.body,
        'general',
        { screen: 'Home' }
      );
      count++;
    }

    console.log(`[CronService] Morning tip dispatched to ${count} users.`);
    return { sent: count };
  } catch (error) {
    console.error('[CronService] Error sending morning tip:', error);
    throw error;
  }
};

// ─── 3. Evening Engagement Notification (6:00 PM IST) ────────────────────────
const sendEveningEngagementNotification = async () => {
  console.log('[CronService] Running Evening Engagement Notification Broadcast...');
  try {
    const users = await User.find({ role: 'user' }).select('_id');
    if (!users.length) {
      console.log('[CronService] No users found for evening engagement.');
      return { sent: 0 };
    }

    const dayIdx = getDayOfYear();
    const promo = EVENING_PROMOS[dayIdx % EVENING_PROMOS.length];

    console.log(`[CronService] Broadcasting evening promo to ${users.length} users: "${promo.title}"`);

    let count = 0;
    for (const user of users) {
      await sendUserNotification(
        user._id,
        promo.title,
        promo.body,
        'general',
        { screen: 'Home' }
      );
      count++;
    }

    console.log(`[CronService] Evening engagement dispatched to ${count} users.`);
    return { sent: count };
  } catch (error) {
    console.error('[CronService] Error sending evening engagement notification:', error);
    throw error;
  }
};

// ─── Legacy alias (for backward-compat with admin manual trigger endpoint) ────
const sendDailyEngagingNotifications = sendEveningEngagementNotification;

module.exports = {
  sendDailyPocketMoneyNotifications,
  sendMorningFinancialTip,
  sendEveningEngagementNotification,
  // Legacy alias
  sendDailyEngagingNotifications,
};
