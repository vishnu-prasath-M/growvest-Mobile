const mongoose = require('mongoose');
const { getUserPortfolioSummary } = require('./utils/portfolioHelper');
const User = require('./models/User');

const MONGO_URI = 'mongodb+srv://vishnuprasath:8925699005@grow-clust.bynj9dx.mongodb.net/growvest?appName=Grow-Clust';

// Fix DNS SRV lookup on Windows
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function testPortfolio() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const users = await User.find().limit(5);
  for (const user of users) {
    const summary = await getUserPortfolioSummary(user._id);
    if (summary) {
      console.log(`\n=== Portfolio for ${user.username} (${user.email}) ===`);
      console.log('Total Balance:', summary.balances.totalBalance);
      console.log('Total Invested:', summary.balances.totalInvested);
      console.log('Total Locked:', summary.balances.totalLocked);
      console.log('Daily Interest:', summary.balances.dailyInterest);
      console.log('Total Interest Earned:', summary.balances.totalInterestEarned);
      console.log('Available to Withdraw:', summary.balances.availableToWithdraw);
      console.log('Active Investments Count:', summary.stats.activeInvestmentsCount);
    }
  }

  process.exit(0);
}

testPortfolio().catch(err => {
  console.error(err);
  process.exit(1);
});
