const User = require('../models/User');
const Investment = require('../models/Investment');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');

// @desc    Get user dashboard data
// @route   GET /api/mobile/dashboard
// @access  Private
const getDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');

    // Get user's investments
    const investments = await Investment.find({
      $or: [{ userEmail: user.email }, { mobileNumber: user.mobileNumber }]
    });

    // Get user's transactions
    const transactions = await Transaction.find({ userEmail: user.email })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get user's withdrawals
    const withdrawals = await Withdrawal.find({ userEmail: user.email })
      .sort({ createdAt: -1 });

    // Calculate balances
    const savingInvestments = investments.filter(inv => inv.type === 'saving' && inv.status === 'approved');
    const fixedInvestments = investments.filter(inv => inv.type === 'fixed' && inv.status === 'approved');

    const savingBalance = savingInvestments.reduce((sum, inv) => sum + inv.amount + (inv.interestEarned || 0), 0);
    const fixedBalance = fixedInvestments.reduce((sum, inv) => sum + inv.amount + (inv.interestEarned || 0), 0);
    const totalInterest = investments.reduce((sum, inv) => sum + (inv.interestEarned || 0), 0);
    const totalBalance = savingBalance + fixedBalance;

    // Calculate available to withdraw (only from saving deposits)
    const availableToWithdraw = savingBalance;

    // Count pending requests
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
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getDashboard,
};
