const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config();

const Investment = require('./models/Investment');
const ChitMember = require('./models/ChitMember');
const User = require('./models/User');

async function debugUserInvestments() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb+srv://vishnuprasath:8925699005@grow-clust.bynj9dx.mongodb.net/growvest?appName=Grow-Clust';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB!');

    const users = await User.find({}).lean();
    console.log(`\n=== USERS (${users.length}) ===`);
    users.forEach(u => {
      console.log(`- ID: ${u._id} | Name: "${u.name}" | Email: "${u.email}" | Phone: "${u.mobileNumber}" | Role: "${u.role}"`);
    });

    const investments = await Investment.find({}).lean();
    console.log(`\n=== INVESTMENTS (${investments.length}) ===`);
    investments.forEach(inv => {
      console.log(`- ID: ${inv._id} | Ref: ${inv.ref} | Amt: ₹${inv.amount} | Status: "${inv.status}" | Type: "${inv.type}" | UserId: ${inv.userId} | UserEmail: "${inv.userEmail}" | Mobile: "${inv.mobileNumber}"`);
    });

    const chitMembers = await ChitMember.find({}).populate('chitId').lean();
    console.log(`\n=== CHIT MEMBERS (${chitMembers.length}) ===`);
    chitMembers.forEach(cm => {
      console.log(`- ID: ${cm._id} | ChitName: "${cm.chitId?.name}" | Status: "${cm.status}" | TotalPaid: ₹${cm.totalPaid} | PaidWeeks: ${cm.paidWeeks} | UserId: ${cm.userId}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error debugging DB:', err);
  }
}

debugUserInvestments();
