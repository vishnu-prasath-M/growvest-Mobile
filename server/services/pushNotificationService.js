/**
 * Server-side Expo Push notification service.
 * Replaces the failing Firebase implementation to use Expo's native HTTP API.
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

const sendToTokens = async (tokens, payload) => {
  if (!tokens?.length) {
    return { success: false, reason: 'no_tokens' };
  }

  const messages = tokens
    .filter((token) => token && token.startsWith('ExponentPushToken'))
    .map((token) => buildMessage(token, payload));

  if (messages.length === 0) {
    return { success: false, reason: 'no_valid_expo_tokens' };
  }

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

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error sending Expo push notifications:', error);
    return { success: false, error: error.message };
  }
};

const sendToUser = async (userId, payload) => {
  try {
    const user = await User.findById(userId).select('fcmTokens');
    if (!user?.fcmTokens?.length) {
      return { success: false, reason: 'no_tokens' };
    }

    // Extract raw tokens string
    const tokens = user.fcmTokens.map((entry) => entry.token).filter(Boolean);
    return await sendToTokens(tokens, payload);
  } catch (error) {
    console.error('Error in sendToUser:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  isPushConfigured: () => true, // Always configured now via Expo API
  sendToUser,
  sendToTokens,
};
