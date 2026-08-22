const mongoose = require('mongoose');
require('dotenv').config({ path: '../server/.env' });

const Investment = require('../server/models/Investment');
const ChitMember = require('../server/models/ChitMember');
const User = require('../server/models/User');

async function debugUserInvestments() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB!');

    const users = await User.find({}).lean();
    console.log(`\nFound ${users.length} total users:`);
    users.forEach(u => {
      console.log(`- User ID: ${u._id}, Email: "${u.email}", Phone: "${u.mobileNumber}", Username: "${u.username}", Role: "${u.role}"`);
    });

    const investments = await Investment.find({}).lean();
    console.log(`\nFound ${investments.length} total Investment records:`);
    investments.forEach(inv => {
      console.log(`- Inv ID: ${inv._id}, Ref: ${inv.ref}, Amount: ${inv.amount}, Status: "${inv.status}", Type: "${inv.type}", UserId: ${inv.userId}, UserEmail: "${inv.userEmail}", Mobile: "${inv.mobileNumber}"`);
    });

    const chitMembers = await ChitMember.find({}).populate('chitId').lean();
    console.log(`\nFound ${chitMembers.length} total ChitMember records:`);
    chitMembers.forEach(cm => {
      console.log(`- Member ID: ${cm._id}, ChitName: "${cm.chitId?.name}", Status: "${cm.status}", AdminApproval: "${cm.adminApprovalStatus}", TotalPaid: ${cm.totalPaid}, PaidWeeks: ${cm.paidWeeks}, UserId: ${cm.userId}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error debugging DB:', err);
  }
}

debugUserInvestments();
