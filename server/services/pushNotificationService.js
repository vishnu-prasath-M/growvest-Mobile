/**
 * Server-side Expo Push notification service.
 * Uses Expo's native HTTP Push API.
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */

const User = require('../models/User');

const buildMessage = (token, { title, body, data = {} }) => ({
  to: token,
  sound: 'default',
  title,
  body,
  data,
  priority: 'high',
});

/**
 * Send push notifications to a list of Expo push tokens.
 * Logs per-ticket errors returned by the Expo API (e.g. DeviceNotRegistered).
 */
const sendToTokens = async (tokens, payload) => {
  if (!tokens?.length) {
    return { success: false, reason: 'no_tokens' };
  }

  // Only send to valid ExponentPushToken[...] format tokens
  const validTokens = tokens.filter(
    (token) => token && typeof token === 'string' && token.startsWith('ExponentPushToken')
  );

  if (validTokens.length === 0) {
    console.warn('[PushService] No valid ExponentPushToken entries found. Raw tokens:', tokens);
    return { success: false, reason: 'no_valid_expo_tokens' };
  }

  const messages = validTokens.map((token) => buildMessage(token, payload));

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const responseData = await response.json();

    // Log any per-ticket errors returned by Expo
    const tickets = Array.isArray(responseData.data) ? responseData.data : [];
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'error') {
        console.error(
          `[PushService] Expo push ticket error for token ${validTokens[i]}:`,
          ticket.message,
          ticket.details
        );
      }
    });

    console.log(`[PushService] Sent ${validTokens.length} push message(s). Response:`, JSON.stringify(responseData));
    return { success: true, data: responseData };
  } catch (error) {
    console.error('[PushService] Error sending Expo push notifications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Look up a user's stored Expo push tokens and send a push notification.
 * Automatically prunes tokens that are flagged as DeviceNotRegistered by Expo.
 */
const sendToUser = async (userId, payload) => {
  try {
    const user = await User.findById(userId).select('fcmTokens');
    if (!user) {
      console.warn(`[PushService] sendToUser: user ${userId} not found`);
      return { success: false, reason: 'user_not_found' };
    }

    if (!user.fcmTokens?.length) {
      console.warn(`[PushService] sendToUser: no tokens stored for user ${userId}`);
      return { success: false, reason: 'no_tokens' };
    }

    const tokens = user.fcmTokens.map((entry) => entry.token).filter(Boolean);
    console.log(`[PushService] sendToUser: found ${tokens.length} token(s) for user ${userId}:`, tokens);

    const result = await sendToTokens(tokens, payload);

    // Prune stale DeviceNotRegistered tokens to keep the list clean
    if (result.success) {
      const tickets = Array.isArray(result.data?.data) ? result.data.data : [];
      const staleTokens = [];
      tickets.forEach((ticket, i) => {
        if (
          ticket.status === 'error' &&
          ticket.details?.error === 'DeviceNotRegistered'
        ) {
          staleTokens.push(tokens[i]);
        }
      });

      if (staleTokens.length > 0) {
        console.log(`[PushService] Pruning ${staleTokens.length} stale token(s) for user ${userId}`);
        await User.findByIdAndUpdate(userId, {
          $pull: { fcmTokens: { token: { $in: staleTokens } } },
        });
      }
    }

    return result;
  } catch (error) {
    console.error('[PushService] Error in sendToUser:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  isPushConfigured: () => true,
  sendToUser,
  sendToTokens,
};
