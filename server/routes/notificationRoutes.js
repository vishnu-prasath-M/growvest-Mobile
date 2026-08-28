const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  createNotification,
  getUnreadCount,
  deleteNotification,
} = require('../controllers/notificationController');
const { protect, admin } = require('../middleware/authMiddleware');
const pushNotificationService = require('../services/pushNotificationService');

// Static routes MUST come before dynamic (:id) routes to avoid conflicts
router.get('/', protect, getNotifications);
router.get('/unread-count', protect, getUnreadCount);
router.put('/read-all', protect, markAllAsRead);
router.put('/:id/read', protect, markAsRead);
router.delete('/:id', protect, deleteNotification);
router.post('/', protect, admin, createNotification);

// Admin: Send test push notification
// POST /api/notifications/test-push
// Body: { targetUserId?, title, body }
router.post('/test-push', protect, admin, async (req, res) => {
  try {
    const { targetUserId, title, body } = req.body;
    const userId = targetUserId || req.user._id || req.user.id;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'targetUserId or authenticated user required' });
    }

    const payload = {
      title: title || 'Test from Admin',
      body: body || 'Push notification is working!',
      data: { type: 'admin_test', sentAt: new Date().toISOString() },
    };

    console.log('[TestPush] Admin ' + req.user._id + ' sending test push to user ' + userId);
    const result = await pushNotificationService.sendToUser(userId, payload);
    console.log('[TestPush] Result:', JSON.stringify(result));

    if (result.success) {
      return res.json({ success: true, message: 'Push notification dispatched successfully' });
    } else {
      const reason = result.reason === 'no_tokens'
        ? 'User has no registered device token. Ask them to open the app and log in first.'
        : result.reason === 'user_not_found'
        ? 'User not found in database.'
        : result.error || 'Expo push API returned an error';
      return res.status(400).json({ success: false, message: reason });
    }
  } catch (error) {
    console.error('[TestPush] Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// User: Schedule a Due Reminder via reliable FCM Server Push
// POST /api/notifications/schedule-due-reminder
// Body: { seconds, chitName, amount, isWeekly }
router.post('/schedule-due-reminder', protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { seconds = 10, chitName = 'Chit Fund Plan', amount = 0, isWeekly = false } = req.body;

    const delayMs = Math.max(1000, Number(seconds) * 1000);

    console.log(`[DueReminder] Scheduling FCM Push reminder for user ${userId} in ${seconds}s for "${chitName}"`);

    setTimeout(async () => {
      try {
        const payload = {
          title: '📅 Growvest Due Reminder',
          body: `Reminder: Your ${isWeekly ? 'weekly' : 'monthly'} due of ₹${amount} for "${chitName}" is due soon.`,
          data: { screen: 'MonthlyDue', type: 'due_reminder' },
        };
        const result = await pushNotificationService.sendToUser(userId, payload);
        console.log(`[DueReminder] FCM Push dispatched to user ${userId}:`, result?.success ? 'SUCCESS' : 'FAILED');
      } catch (err) {
        console.error('[DueReminder] Error dispatching scheduled push:', err.message);
      }
    }, delayMs);

    return res.json({
      success: true,
      message: `Reminder scheduled. Push notification will arrive in ${seconds} seconds.`,
    });
  } catch (error) {
    console.error('[DueReminder] Error scheduling reminder:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
