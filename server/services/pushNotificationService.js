/**
 * Server-side FCM push helper (ready for admin/investment/withdrawal triggers).
 *
 * Set FIREBASE_SERVICE_ACCOUNT_JSON in the server environment to the full
 * Firebase service account JSON string before enabling sends.
 *
 * Example payload data for the mobile app:
 * {
 *   "type": "investment_approved",
 *   "amount": "5000",
 *   "screen": "Investments"
 * }
 */

const User = require('../models/User');

const isPushConfigured = () => Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

const getFirebaseMessaging = async () => {
  if (!isPushConfigured()) {
    return null;
  }

  try {
    const admin = require('firebase-admin');

    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    return admin.messaging();
  } catch (error) {
    console.error('Firebase Admin not available for push notifications:', error.message);
    return null;
  }
};

const buildMessage = (token, { title, body, data = {} }) => ({
  token,
  notification: {
    title,
    body,
  },
  data: Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, String(value ?? '')])
  ),
  android: {
    priority: 'high',
    notification: {
      channelId: 'growvest-default',
      sound: 'default',
    },
  },
});

const sendToTokens = async (tokens, payload) => {
  const messaging = await getFirebaseMessaging();
  if (!messaging || !tokens?.length) {
    return { success: false, reason: 'push_not_configured_or_no_tokens' };
  }

  const results = await Promise.allSettled(
    tokens.map((token) => messaging.send(buildMessage(token, payload)))
  );

  return {
    success: true,
    sent: results.filter((result) => result.status === 'fulfilled').length,
    failed: results.filter((result) => result.status === 'rejected').length,
  };
};

const sendToUser = async (userId, payload) => {
  const user = await User.findById(userId).select('fcmTokens');
  if (!user?.fcmTokens?.length) {
    return { success: false, reason: 'no_tokens' };
  }

  const tokens = user.fcmTokens.map((entry) => entry.token).filter(Boolean);
  return sendToTokens(tokens, payload);
};

module.exports = {
  isPushConfigured,
  sendToUser,
  sendToTokens,
};
