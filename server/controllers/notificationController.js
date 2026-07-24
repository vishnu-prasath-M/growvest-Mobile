const Notification = require('../models/Notification');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100);
    
    const unreadCount = await Notification.countDocuments({ userId, read: false });
    
    res.json({
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId },
      { read: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    const unreadCount = await Notification.countDocuments({ userId, read: false });
    
    res.json({ notification, unreadCount });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    await Notification.updateMany(
      { userId, read: false },
      { read: true }
    );
    
    res.json({ message: 'All notifications marked as read', unreadCount: 0 });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create a notification (internal use / admin)
// @route   POST /api/notifications
// @access  Private/Admin
exports.createNotification = async (req, res) => {
  try {
    const { userId, title, description, type, icon, metadata } = req.body;
    
    if (!userId || !title || !description || !type) {
      return res.status(400).json({ message: 'userId, title, description and type are required' });
    }
    
    const notification = await Notification.create({
      userId,
      title,
      description,
      type,
      icon: icon || getIconForType(type),
      metadata
    });
    
    res.status(201).json(notification);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, userId });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    const unreadCount = await Notification.countDocuments({ userId, read: false });
    res.json({ message: 'Notification deleted', unreadCount });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const unreadCount = await Notification.countDocuments({ userId, read: false });
    res.json({ unreadCount });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper to get icon based on type
function getIconForType(type) {
  const iconMap = {
    'investment_approved': 'check-decagram',
    'investment_rejected': 'close-circle',
    'withdrawal_approved': 'bank-transfer-out',
    'withdrawal_rejected': 'close-circle',
    'chit_joined': 'handshake',
    'chit_join_approved': 'handshake',
    'chit_join_rejected': 'close-circle',
    'chit_payment_approved': 'check-circle',
    'chit_payment_rejected': 'close-circle',
    'new_chit_available': 'bell-ring',
    'chit_closed': 'lock',
    'due_reminder': 'bell-alert',
    'kyc_approved': 'shield-check',
    'kyc_rejected': 'shield-off',
    'general': 'bell-outline',
  };
  return iconMap[type] || 'bell-outline';
}