const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config();

const Investment = require('./models/Investment');
const User = require('./models/User');

async function migrateOrphanInvestments() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb+srv://vishnuprasath:8925699005@grow-clust.bynj9dx.mongodb.net/growvest?appName=Grow-Clust';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB!');

    const users = await User.find({}).lean();
    let updatedCount = 0;

    for (const user of users) {
      const orphanConditions = [];
      if (user.email && String(user.email).trim() !== '' && user.email !== 'undefined') {
        orphanConditions.push({ userEmail: new RegExp(`^${String(user.email).trim()}$`, 'i') });
      }
      if (user.mobileNumber && String(user.mobileNumber).trim() !== '' && user.mobileNumber !== 'undefined') {
        orphanConditions.push({ mobileNumber: String(user.mobileNumber).trim() });
      }

      if (orphanConditions.length > 0) {
        const res = await Investment.updateMany(
          { 
            $or: [
              { userId: { $exists: false } },
              { userId: null }
            ],
            $or: orphanConditions 
          },
          { $set: { userId: user._id } }
        );
        updatedCount += res.modifiedCount;
        if (res.modifiedCount > 0) {
          console.log(`Updated ${res.modifiedCount} orphan investments for User: ${user.name} (${user.email || user.mobileNumber})`);
        }
      }
    }

    console.log(`Migration Complete: Linked ${updatedCount} orphan investments to user accounts.`);
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error during migration:', err);
  }
}

migrateOrphanInvestments();
