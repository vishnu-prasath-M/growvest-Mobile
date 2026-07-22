const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://vishnuprasath:8925699005@grow-clust.bynj9dx.mongodb.net/growvest?appName=Grow-Clust');

setTimeout(async () => {
  const User = require('./server/models/User');
  const users = await User.find({ 'fcmTokens.0': { $exists: true } }).select('_id username email fcmTokens');
  if (users.length === 0) {
    console.log('NO USERS WITH FCM TOKENS FOUND.');
    console.log('Make sure you are logged into the app on a physical device and notification permission is granted.');
  } else {
    users.forEach(u => {
      console.log('\n=== USER:', u._id, '|', u.username || u.email, '===');
      u.fcmTokens.forEach(t => console.log('  TOKEN:', t.token, '| Platform:', t.platform));
    });
  }
  process.exit(0);
}, 4000);
