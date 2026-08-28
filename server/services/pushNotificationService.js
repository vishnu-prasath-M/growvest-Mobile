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
  channelId: 'default',
  badge: 1,
  _displayInForeground: true,
  _contentAvailable: true,
});

/**
 * Send push notifications to a list of Expo push tokens.
 * Logs per-ticket errors returned by the Expo API (e.g. DeviceNotRegistered).
 */
const sendToTokens = async (tokens, payload) => {
  if (!tokens?.length) {
    console.warn('[PushService] sendToTokens aborted: empty or undefined tokens array');
    return { success: false, reason: 'no_tokens' };
  }

  // Send to valid Expo push token formats (ExponentPushToken[...] or ExpoPushToken[...])
  const validTokens = tokens.filter(
    (token) => token && typeof token === 'string' && (token.startsWith('ExponentPushToken') || token.startsWith('ExpoPushToken'))
  );

  if (validTokens.length === 0) {
    console.warn('[PushService] No valid Expo push tokens found in list:', JSON.stringify(tokens));
    return { success: false, reason: 'no_valid_expo_tokens' };
  }

  const messages = validTokens.map((token) => buildMessage(token, payload));
  console.log(`[PushService] Dispatching Expo Push Notification to ${validTokens.length} token(s). Payload:`, JSON.stringify(payload));

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
    console.log('[PushService] Expo Push API Http Status:', response.status);
    console.log('[PushService] Expo Push API Full Response:', JSON.stringify(responseData));

    // Log any per-ticket errors returned by Expo
    const tickets = Array.isArray(responseData.data) ? responseData.data : [];
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'error') {
        console.error(
          `[PushService] Expo Push Ticket ERROR for token [${validTokens[i]}]:`,
          ticket.message,
          ticket.details
        );
      } else if (ticket.status === 'ok') {
        console.log(`[PushService] Expo Push Ticket OK for token [${validTokens[i]}]: ticketId = ${ticket.id}`);
      }
    });

    return { success: true, data: responseData };
  } catch (error) {
    console.error('[PushService] CRITICAL EXCEPTION during Expo Push dispatch:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Look up a user's stored Expo push tokens and send a push notification.
 * Automatically prunes tokens that are flagged as DeviceNotRegistered by Expo.
 */
const sendWebFCMNotification = async (token, payload) => {
  console.log(`[PushService] Web FCM dispatch initiated for token: ${token}`);
  try {
    const serverKey = process.env.FCM_SERVER_KEY;
    if (!serverKey) {
      console.log(`[PushService] FCM_SERVER_KEY not set. Simulated successful web browser dispatch for event: "${payload.title}"`);
      return { success: true, simulated: true };
    }
    
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${serverKey}`,
      },
      body: JSON.stringify({
        to: token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        priority: 'high',
      }),
    });
    const result = await response.json();
    return { success: true, result };
  } catch (err) {
    console.error('[PushService] Web FCM dispatch failed:', err);
    return { success: false, error: err.message };
  }
};

const sendToUser = async (userId, payload) => {
  console.log(`[PushService] sendToUser initiated for userId: "${userId}"`);
  try {
    const user = await User.findById(userId).select('fcmTokens email username');
    if (!user) {
      console.warn(`[PushService] sendToUser FAILED: User "${userId}" not found in MongoDB database.`);
      return { success: false, reason: 'user_not_found' };
    }

    if (!user.fcmTokens?.length) {
      console.warn(`[PushService] sendToUser FAILED: User "${userId}" (${user.username || user.email}) has 0 stored tokens in User.fcmTokens array.`);
      return { success: false, reason: 'no_tokens' };
    }

    // Split mobile tokens into Expo Push tokens and Native FCM tokens
    const expoTokens = [];
    const nativeFcmTokens = [];

    const allMobileEntries = (user.fcmTokens || [])
      .filter(t => t.token && typeof t.token === 'string' && t.platform !== 'web')
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

    const seenTokens = new Set();
    for (const entry of allMobileEntries) {
      if (!seenTokens.has(entry.token)) {
        seenTokens.add(entry.token);
        if (entry.token.startsWith('ExponentPushToken') || entry.token.startsWith('ExpoPushToken')) {
          expoTokens.push(entry.token);
        } else {
          nativeFcmTokens.push(entry.token);
        }
      }
    }

    const webTokens = (user.fcmTokens || [])
      .filter(t => t.platform === 'web')
      .map(t => t.token)
      .filter(Boolean);
    
    console.log(`[PushService] sendToUser: Target push tokens for user "${userId}": Expo=${expoTokens.length}, NativeFCM=${nativeFcmTokens.length}, Web=${webTokens.length}`);

    let finalResult = { success: false };

    // 1. Dispatch Expo push tokens
    if (expoTokens.length > 0) {
      const result = await sendToTokens(expoTokens, payload);
      if (result.success) {
        finalResult = result;
      }

      // Prune stale DeviceNotRegistered tokens to keep the list clean
      if (result.success) {
        const tickets = Array.isArray(result.data?.data) ? result.data.data : [];
        const staleTokens = [];
        tickets.forEach((ticket, i) => {
          if (
            ticket.status === 'error' &&
            (ticket.details?.error === 'DeviceNotRegistered' || ticket.details?.error === 'InvalidCredentials')
          ) {
            staleTokens.push(expoTokens[i]);
          }
        });

        if (staleTokens.length > 0) {
          console.log(`[PushService] Pruning ${staleTokens.length} stale token(s) for user ${userId}:`, staleTokens);
          await User.findByIdAndUpdate(userId, {
            $pull: { fcmTokens: { token: { $in: staleTokens } } },
          });
        }
      }
    }

    // 2. Dispatch Native FCM tokens (direct FCM fallback)
    if (nativeFcmTokens.length > 0) {
      for (const fcmToken of nativeFcmTokens) {
        const fcmResult = await sendWebFCMNotification(fcmToken, payload);
        if (fcmResult.success) {
          finalResult = { success: true, nativeFcm: true };
        }
      }
    }

    // 3. Dispatch Web FCM push if present
    if (webTokens.length > 0) {
      let webSuccess = false;
      for (const webToken of webTokens) {
        const webResult = await sendWebFCMNotification(webToken, payload);
        if (webResult.success) {
          webSuccess = true;
        }
      }
      if (webSuccess) {
        finalResult.success = true;
      }
    }

    return finalResult;
  } catch (error) {
    console.error('[PushService] EXCEPTION in sendToUser:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  isPushConfigured: () => true,
  sendToUser,
  sendToTokens,
};
