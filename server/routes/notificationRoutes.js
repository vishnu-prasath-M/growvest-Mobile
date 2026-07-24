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

// Static routes MUST come before dynamic (:id) routes to avoid conflicts
router.get('/', protect, getNotifications);
router.get('/unread-count', protect, getUnreadCount);          // before /:id
router.put('/read-all', protect, markAllAsRead);               // before /:id/read
router.put('/:id/read', protect, markAsRead);
router.delete('/:id', protect, deleteNotification);            // user-isolated: filters by { _id, userId }
router.post('/', protect, admin, createNotification);

module.exports = router;