const Investment = require('../models/Investment');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');
const User = require('../models/User');

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