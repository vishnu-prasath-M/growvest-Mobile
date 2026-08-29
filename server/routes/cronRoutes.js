const express = require('express');
const router = express.Router();
const cronService = require('../services/cronService');

// POST / GET /api/cron/daily-notifications?type=pocket_money|morning_tip|evening|all&secret=growvest-daily-secret-2026
// Triggered by GitHub Actions daily cron or external scheduler (cron-job.org)
const handleDailyNotifications = async (req, res) => {
  try {
    const cronSecret = process.env.CRON_SECRET || 'growvest-daily-secret-2026';
    const authHeader = req.headers['x-cron-secret'] || req.query.secret;

    if (cronSecret && authHeader !== cronSecret) {
      console.warn('[CronRoute] Unauthorized daily notification trigger attempt');
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const type = req.query.type || 'all';
    console.log(`[CronRoute] Executing daily notification dispatch — type: "${type}"`);

    const results = {};

    if (type === 'pocket_money' || type === 'all') {
      console.log('[CronRoute] → Running Pocket Money Payout Notifications...');
      await cronService.sendDailyPocketMoneyNotifications();
      results.pocket_money = 'dispatched';
    }

    if (type === 'chit_due' || type === 'all') {
      console.log('[CronRoute] → Running Chit Due Reminders (within 4 days)...');
      await cronService.sendChitDueReminders();
      results.chit_due = 'dispatched';
    }

    if (type === 'morning_tip' || type === 'all') {
      console.log('[CronRoute] → Running Morning Financial Tip Broadcast...');
      await cronService.sendMorningFinancialTip();
      results.morning_tip = 'dispatched';
    }

    if (type === 'evening' || type === 'all') {
      console.log('[CronRoute] → Running Evening Engagement Notification...');
      await cronService.sendEveningEngagementNotification();
      results.evening = 'dispatched';
    }

    return res.status(200).json({
      success: true,
      type,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CronRoute] Error executing daily notifications:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

router.get('/daily-notifications', handleDailyNotifications);
router.post('/daily-notifications', handleDailyNotifications);

module.exports = router;
