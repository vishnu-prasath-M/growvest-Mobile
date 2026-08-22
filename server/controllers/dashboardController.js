const Investment = require('../models/Investment');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');
const Chit = require('../models/Chit');
const ChitMember = require('../models/ChitMember');
const ChitPayment = require('../models/ChitPayment');
const KYC = require('../models/KYC');
const Notification = require('../models/Notification');

// @desc    Get user dashboard data with calculated balances
// @route   GET /api/dashboard
// @access  Private
exports.getDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const PocketMoney = require('../models/PocketMoney');
    const pocketMonies = await PocketMoney.find({ userId: user._id });
    const pocketReleased = pocketMonies.reduce((sum, pm) => sum + (pm.totalPaidOut || 0), 0);
    const pocketInvested = pocketMonies.reduce((sum, pm) => sum + (pm.investedAmount || 0), 0);
    const pocketRemaining = pocketMonies.reduce((sum, pm) => sum + (pm.remainingAmount || 0), 0);

    // Build robust OR conditions to match all user investments
    const userOrConditions = [{ userId: user._id }];
    if (user.email && String(user.email).trim() !== '' && user.email !== 'undefined') {
      userOrConditions.push({ userEmail: new RegExp(`^${String(user.email).trim()}$`, 'i') });
    }
    if (user.mobileNumber && String(user.mobileNumber).trim() !== '' && user.mobileNumber !== 'undefined') {
      userOrConditions.push({ mobileNumber: String(user.mobileNumber).trim() });
    }

    // Get user's investments
    const investments = await Investment.find({ $or: userOrConditions });

    // Get recent transactions
    const transactions = await Transaction.find({ $or: userOrConditions })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get withdrawals
    const withdrawals = await Withdrawal.find({ $or: userOrConditions }).sort({ createdAt: -1 });

    // Calculate balances based on both duration investments & chit fund memberships
    const activeInvestments = investments.filter(inv => inv.status === 'approved');
    const durationInvested = activeInvestments.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalInterestEarned = investments.reduce((sum, inv) => sum + (inv.interestEarned || inv.totalInterest || 0), 0);

    // Active Chit memberships paid contribution
    const activeChitMembers = await ChitMember.find({ userId: user._id, status: 'active' });
    const chitInvested = activeChitMembers.reduce((sum, m) => sum + (m.totalPaid || (m.paidWeeks || 1) * (m.weeklyAmount || 0)), 0);

    const totalInvested = durationInvested + chitInvested;
    const activeInvestmentsCount = activeInvestments.length + activeChitMembers.length;

    // Matured investments available to withdraw
    const now = new Date();
    const maturedAmount = activeInvestments
      .filter(inv => inv.maturityDate && now >= new Date(inv.maturityDate))
      .reduce((sum, inv) => sum + (inv.maturityAmount || (inv.amount + (inv.totalInterest || 0))), 0);

    // Get won chit memberships for winning amount calculation
    const wonMemberships = await ChitMember.find({ userId: user._id, hasWon: true });
    const totalChitWinningAmount = wonMemberships.reduce((sum, m) => sum + (m.winningAmount || 0), 0);

    const walletBalance = user.balance || 0;
    const availableToWithdraw = maturedAmount + walletBalance + totalChitWinningAmount;
    const totalBalance = totalInvested + totalInterestEarned + walletBalance + totalChitWinningAmount;

    // Legacy fields for backward compatibility
    const savingBalance = availableToWithdraw;
    const fixedBalance = 0;
    const totalInterest = totalInterestEarned;

    // Pending count
    const pendingInvestments = investments.filter(inv => inv.status === 'pending').length;
    const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').length;
    const pendingRequests = pendingInvestments + pendingWithdrawals;

    res.json({
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
        mobileNumber: user.mobileNumber,
        email: user.email,
        balance: totalBalance,
        winningAmount: totalChitWinningAmount,
        role: user.role,
      },
      balances: {
        totalBalance,
        totalInvested,
        totalInterestEarned,
        totalEarned: totalInterestEarned,
        availableToWithdraw,
        maturedAmount,
        walletBalance,
        totalChitWinningAmount,
        savingBalance,
        fixedBalance,
        totalInterest,
      },
      stats: {
        totalInvestments: activeInvestmentsCount,
        activeInvestmentsCount,
        pendingRequests,
        totalPocketInvested: pocketInvested,
        totalPocketReleased: pocketReleased,
        totalPocketRemaining: pocketRemaining,
      },
      recentInvestments: investments.slice(0, 5),
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