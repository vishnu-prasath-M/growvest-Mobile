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

    // Get user's investments using userId, email, or mobileNumber
    const investments = await Investment.find({
      $or: [
        { userEmail: user.email },
        { mobileNumber: user.mobileNumber },
      ]
    });

    // Get recent transactions
    const transactions = await Transaction.find({
      $or: [
        { userId: user._id },
        { userEmail: user.email }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get withdrawals
    const withdrawals = await Withdrawal.find({
      $or: [
        { userId: user._id },
        { userEmail: user.email }
      ]
    }).sort({ createdAt: -1 });

    // Calculate balances
    const savingInvestments = investments.filter(inv => inv.type === 'saving' && inv.status === 'approved');
    const fixedInvestments = investments.filter(inv => inv.type === 'fixed' && inv.status === 'approved');

    const savingBalance = savingInvestments.reduce((sum, inv) => sum + inv.amount + (inv.interestEarned || 0), 0);
    const fixedBalance = fixedInvestments.reduce((sum, inv) => sum + inv.amount + (inv.interestEarned || 0), 0);
    const totalInterest = investments.reduce((sum, inv) => sum + (inv.interestEarned || 0), 0);
    const totalBalance = savingBalance + fixedBalance;

    // Available to withdraw (saving deposits only)
    const availableToWithdraw = savingBalance;

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
        balance: user.balance,
        role: user.role,
      },
      balances: {
        savingBalance,
        fixedBalance,
        totalBalance,
        totalInterest,
        availableToWithdraw,
      },
      stats: {
        totalInvestments: investments.length,
        pendingRequests,
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
    });
  } catch (error) {
    console.error('Admin dashboard stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};