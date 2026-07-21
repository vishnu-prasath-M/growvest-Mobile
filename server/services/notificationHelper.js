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

  // Step 1: Create in-app DB notification (same pattern as used across all controllers)
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
    console.warn('[NotificationHelper] DB notification failed (non-fatal):', notifErr.message);
  }

  // Step 2: Send push notification via Expo Push API
  try {
    const pushResult = await sendToUser(userId, {
      title,
      body: description,
      data: { type, ...(pushData || {}) },
    });
    results.push = pushResult.success === true;
    if (!results.push) {
      console.warn(`[NotificationHelper] Push delivery failed for user ${userId} (type: ${type}):`, pushResult.reason || pushResult.error || 'unknown');
    }
  } catch (notifErr) {
    console.warn('[NotificationHelper] Push notification threw (non-fatal):', notifErr.message);
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
    'general': 'bell-outline',
  };
  return iconMap[type] || 'bell-outline';
}

module.exports = { sendNotification };