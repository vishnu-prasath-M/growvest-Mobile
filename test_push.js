/**
 * TEST PUSH NOTIFICATION DIRECTLY
 * Usage: node test_push.js <userId>
 * 
 * This bypasses the HTTP API and calls sendToUser() directly — the same exact
 * function used by Admin actions (Investment Approved, Withdrawal Approved etc.)
 * This proves push works end-to-end without going through any API.
 */
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://vishnuprasath:8925699005@grow-clust.bynj9dx.mongodb.net/growvest?appName=Grow-Clust');

const userId = process.argv[2];
if (!userId) {
  console.error('Usage: node test_push.js <userId>');
  console.log('Run "node check_tokens.js" first to find your userId');
  process.exit(1);
}

setTimeout(async () => {
  const { sendToUser } = require('./server/services/pushNotificationService');
  const { sendNotification } = require('./server/services/notificationHelper');

  console.log(`\n[TEST] Sending push notification to userId: ${userId}`);
  console.log('[TEST] This is the SAME exact function used when Admin approves Investment/Withdrawal/Chit\n');

  const result = await sendNotification({
    userId,
    title: '🔔 Test Push Notification',
    description: 'This is a live test. If you see this, push notifications are working correctly in foreground AND background.',
    type: 'general',
    pushData: { screen: 'Notifications' },
  });

  console.log('\n[TEST] Final Result:', JSON.stringify(result, null, 2));
  console.log('\n[TEST] Check:');
  console.log('  - result.results.push === true → Push was sent to Expo Cloud ✅');
  console.log('  - result.results.db === true   → Saved to MongoDB (shows in notification bell) ✅');
  console.log('  - If push is false but db is true → Expo token is missing or expired (re-login on device)');
  
  process.exit(0);
}, 4000);
