/**
 * Unified Notification Helper
 * 
 * This is the SINGLE implementation for all notifications.
 * Every notification in the system MUST use this helper.
 * 
 * It replicates the exact same flow used by sendWelcomeNotification():
 * 1. Creates in-app DB notification (MongoDB)
 * 2. Sends push notification via Expo Push API
 * 
 * The only things that change per notification type are:
 * - title
 * - body/description
 * - type
 * - icon
 * - metadata (optional reference ID)
 */

const Notification = require('../models/Notification');
const { sendToUser } = require('./pushNotificationService');

/**
 * Send a notification to a user.
 * 
 * @param {Object} options
 * @param {string} options.userId - The user's MongoDB ObjectId
 * @param {string} options.title - Notification title
 * @param {string} options.description - Notification body/description
 * @param {string} options.type - Notification type (must be in Notification schema enum)
 * @param {string} [options.icon] - Icon name (optional, uses type-based default if not provided)
 * @param {Object} [options.metadata] - Additional metadata (optional)
 * @param {Object} [options.pushData] - Extra data for push notification (optional)
 * @returns {Promise<Object>} Result object
 */
async function sendNotification({ userId, title, description, type, icon, metadata, pushData }) {
  if (!userId || !title || !description || !type) {
    console.warn('[NotificationHelper] Missing required fields:', { userId, title, description, type });
    return { success: false, reason: 'missing_required_fields' };
  }

  const results = { db: false, push: false };
  const payload = {
    title,
    body: description,
    data: { type, ...(pushData || {}) },
  };

  // STEP 1: Send Push Notification IMMEDIATELY (Do NOT wait for MongoDB)
  try {
    console.log(`[NotificationHelper] Executing immediate push delivery to user: ${userId}`);
    const pushResult = await sendToUser(userId, payload);
    results.push = pushResult.success === true;
    
    if (!results.push) {
      console.error(`[NotificationHelper] PUSH DELIVERY FAILURE FOR USER ${userId}:`, {
        reason: pushResult.reason || 'Unknown failure',
        error: pushResult.error || null,
        payload,
        resultData: pushResult.data || null,
      });
    } else {
      console.log(`[NotificationHelper] Push notification successfully dispatched to user ${userId}`);
    }
  } catch (pushErr) {
    console.error(`[NotificationHelper] EXCEPTION DURING PUSH DELIVERY FOR USER ${userId}:`, {
      message: pushErr.message,
      stack: pushErr.stack,
      payload,
    });
  }

  // STEP 2: Save notification to MongoDB afterward
  try {
    await Notification.create({
      userId,
      title,
      description,
      type,
      icon: icon || getIconForType(type),
      metadata: metadata || {},
    });
    results.db = true;
  } catch (notifErr) {
    console.warn('[NotificationHelper] DB notification save failed (non-fatal):', notifErr.message);
  }

  return { success: results.db || results.push, results };
}

/**
 * Helper to get icon based on type (mirrors notificationController.getIconForType)
 */
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
    'auction_winner': 'trophy',
    'due_reminder': 'bell-alert',
    'kyc_approved': 'shield-check',
    'kyc_rejected': 'shield-off',
    'pocket_money_approved': 'wallet-giftcard',
    'pocket_money_payout': 'cash-multiple',
    'pocket_money_reminder': 'bell-ring',
    'pocket_money_completed': 'check-decagram',
    'general': 'bell-outline',
  };
  return iconMap[type] || 'bell-outline';
}

/**
 * Send a notification to all admin users.
 * 
 * @param {Object} options
 * @param {string} options.title - Notification title
 * @param {string} options.description - Notification body/description
 * @param {string} options.type - Notification type
 * @param {Object} [options.metadata] - Additional metadata
 * @returns {Promise<void>}
 */
async function notifyAdmins({ title, description, type = 'general', metadata }) {
  try {
    const User = require('../models/User');
    const admins = await User.find({ role: 'admin' });
    console.log(`[NotificationHelper] Notifying ${admins.length} admins of event: ${title}`);
    for (const admin of admins) {
      await sendNotification({
        userId: admin._id,
        title,
        description,
        type,
        metadata
      });
    }
/**
 * Send a notification to all active users.
 * 
 * @param {Object} options
 * @param {string} options.title - Notification title
 * @param {string} options.description - Notification body/description
 * @param {string} options.type - Notification type
 * @param {Object} [options.metadata] - Additional metadata
 * @param {Object} [options.pushData] - Extra push payload data
 * @returns {Promise<void>}
 */
async function notifyAllUsers({ title, description, type = 'general', metadata, pushData }) {
  try {
    const User = require('../models/User');
    const users = await User.find({ role: 'user' });
    console.log(`[NotificationHelper] Broadcasting notification to ${users.length} users: ${title}`);
    for (const user of users) {
      await sendNotification({
        userId: user._id,
        title,
        description,
        type,
        metadata,
        pushData,
      });
    }
  } catch (err) {
    console.error('[NotificationHelper] Error in notifyAllUsers:', err);
  }
}

module.exports = { sendNotification, notifyAdmins, notifyAllUsers };