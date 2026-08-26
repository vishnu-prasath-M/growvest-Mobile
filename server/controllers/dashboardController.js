const Investment = require('../models/Investment');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const Chit = require('../models/Chit');
const ChitMember = require('../models/ChitMember');
const ChitPayment = require('../models/ChitPayment');
const KYC = require('../models/KYC');
const Notification = require('../models/Notification');

const { getUserPortfolioSummary } = require('../utils/portfolioHelper');

// @desc    Get user dashboard data with calculated balances
// @route   GET /api/dashboard
// @access  Private
exports.getDashboard = async (req, res) => {
  try {
    const summary = await getUserPortfolioSummary(req.user.id);
    if (!summary) {
      return res.status(404).json({ message: 'User not found' });
    }

    const PocketMoney = require('../models/PocketMoney');
    const pocketMonies = await PocketMoney.find({ userId: req.user.id });
    const pocketReleased = pocketMonies.reduce((sum, pm) => sum + (pm.totalPaidOut || 0), 0);
    const pocketInvested = pocketMonies.reduce((sum, pm) => sum + (pm.investedAmount || 0), 0);
    const pocketRemaining = pocketMonies.reduce((sum, pm) => sum + (pm.remainingAmount || 0), 0);

    const transactions = await Transaction.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(10);
    const withdrawals = await Withdrawal.find({ userId: req.user.id }).sort({ createdAt: -1 });

    const pendingInvestments = summary.investments.filter(inv => inv.status === 'pending').length;
    const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').length;
    const pendingRequests = pendingInvestments + pendingWithdrawals;

    res.json({
      user: summary.user,
      balances: summary.balances,
      stats: {
        totalInvestments: summary.stats.totalInvestments,
        activeInvestmentsCount: summary.stats.activeInvestmentsCount,
        pendingRequests,
        totalPocketInvested: pocketInvested,
        totalPocketReleased: pocketReleased,
        totalPocketRemaining: pocketRemaining,
      },
      recentInvestments: summary.investments.slice(0, 5),
      recentTransactions: transactions,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get admin dashboard stats (ALL real data from MongoDB)
// @route   GET /api/dashboard/admin-stats
// @access  Private/Admin
exports.getAdminStats = async (req, res) => {
  try {
    // Run all counts in parallel for performance
    const [
      totalUsers,
      verifiedKYC,
      pendingKYC,
      totalInvestments,
      pendingInvestments,
      approvedInvestments,
      rejectedInvestments,
      totalWithdrawals,
      pendingWithdrawals,
      approvedWithdrawals,
      rejectedWithdrawals,
      activeChits,
      pendingChitRequests,
      activeChitMembers,
      totalNotifications,
      revenueResult,
      pocketMoneyStatsResult,
    ] = await Promise.all([
      // Total Users
      User.countDocuments({ role: { $ne: 'admin' } }),
      // Verified KYC
      KYC.countDocuments({ status: 'approved' }),
      // Pending KYC
      KYC.countDocuments({ status: 'pending' }),
      // Total Investments
      Investment.countDocuments(),
      // Pending Investments
      Investment.countDocuments({ status: 'pending' }),
      // Approved Investments
      Investment.countDocuments({ status: 'approved' }),
      // Rejected Investments
      Investment.countDocuments({ status: 'rejected' }),
      // Total Withdrawals
      Withdrawal.countDocuments(),
      // Pending Withdrawals
      Withdrawal.countDocuments({ status: 'pending' }),
      // Approved Withdrawals
      Withdrawal.countDocuments({ status: 'approved' }),
      // Rejected Withdrawals
      Withdrawal.countDocuments({ status: 'rejected' }),
      // Active Chits
      Chit.countDocuments({ status: 'active' }),
      // Pending Chit Join Requests
      Transaction.countDocuments({ referenceType: 'ChitMember', status: 'pending' }),
      // Active Chit Members
      ChitMember.countDocuments({ status: 'active' }),
      // Total Notifications
      Notification.countDocuments(),
      // Total Revenue (sum of all approved investment amounts)
      Investment.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // Pocket Money Stats
      (async () => {
        const PocketMoney = require('../models/PocketMoney');
        const r = await PocketMoney.aggregate([
          {
            $group: {
              _id: null,
              invested: { $sum: '$investedAmount' },
              released: { $sum: '$totalPaidOut' },
              remaining: { $sum: '$remainingAmount' }
            }
          }
        ]);
        const active = await PocketMoney.countDocuments({ status: 'active' });
        const completed = await PocketMoney.countDocuments({ status: 'completed' });
        return {
          invested: r[0]?.invested || 0,
          released: r[0]?.released || 0,
          remaining: r[0]?.remaining || 0,
          active,
          completed
        };
      })()
    ]);

    const revenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    res.json({
      totalUsers,
      verifiedKYC,
      pendingKYC,
      totalInvestments,
      pendingInvestments,
      approvedInvestments,
      rejectedInvestments,
      totalWithdrawals,
      pendingWithdrawals,
      approvedWithdrawals,
      rejectedWithdrawals,
      activeChits,
      pendingChitRequests,
      activeChitMembers,
      totalNotifications,
      revenue,
      pocketMoney: pocketMoneyStatsResult
    });
  } catch (error) {
    console.error('Admin dashboard stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};