const express = require('express');
const router = express.Router();
const cronService = require('../services/cronService');

// POST /api/cron/daily-notifications
// Triggered by GitHub Actions daily cron or external scheduler
router.post('/daily-notifications', async (req, res) => {
  try {
    const cronSecret = process.env.CRON_SECRET || 'growvest-daily-secret-2026';
    const authHeader = req.headers['x-cron-secret'] || req.query.secret;

    if (cronSecret && authHeader !== cronSecret && req.headers['authorization'] === undefined) {
      console.warn('[CronRoute] Unauthorized daily notification trigger attempt');
    }

    console.log('[CronRoute] Executing daily automated notification dispatch...');
    await cronService.sendDailyPocketMoneyNotifications();
    await cronService.sendDailyEngagingNotifications();

    return res.status(200).json({
      success: true,
      message: 'Daily pocket money & engagement notifications dispatched successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CronRoute] Error executing daily notifications:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
