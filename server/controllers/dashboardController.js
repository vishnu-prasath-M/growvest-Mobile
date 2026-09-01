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
      chitStatsResult,
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
      // Pending Chit Join Requests & Pending Payments
      (async () => {
        const [pMembers, pPayments] = await Promise.all([
          ChitMember.countDocuments({ status: 'pending' }),
          ChitPayment.countDocuments({ status: 'pending' }),
        ]);
        return pMembers + pPayments;
      })(),
      // Active Chit Members
      ChitMember.countDocuments({ status: 'active' }),
      // Total Notifications
      Notification.countDocuments(),
      // Total Revenue (sum of all approved saving investment amounts)
      Investment.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
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
              remaining: { $sum: '$remainingAmount' },
              count: { $sum: 1 }
            }
          }
        ]);
        const active = await PocketMoney.countDocuments({ status: 'active' });
        const completed = await PocketMoney.countDocuments({ status: 'completed' });
        return {
          invested: r[0]?.invested || 0,
          released: r[0]?.released || 0,
          remaining: r[0]?.remaining || 0,
          count: r[0]?.count || 0,
          active,
          completed
        };
      })(),
      // Chit Fund Stats (Total Paid Contributions across Members)
      (async () => {
        const ChitMember = require('../models/ChitMember');
        const ChitPayment = require('../models/ChitPayment');
        const [memAgg, payAgg] = await Promise.all([
          ChitMember.aggregate([
            { $match: { status: { $in: ['active', 'approved', 'completed'] } } },
            { $group: { _id: null, total: { $sum: '$totalPaid' }, count: { $sum: 1 } } }
          ]),
          ChitPayment.aggregate([
            { $match: { status: { $in: ['approved', 'completed', 'paid'] } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ])
        ]);
        const total = Math.max(memAgg[0]?.total || 0, payAgg[0]?.total || 0);
        const count = memAgg[0]?.count || 0;
        return { total, count };
      })()
    ]);

    // Fetch recent items from each category for unified overview activity feed
    const [recentInvestments, recentWithdrawals, recentKycs, recentChitMembers, recentPockets] = await Promise.all([
      Investment.find().sort({ createdAt: -1 }).limit(8),
      Withdrawal.find().sort({ createdAt: -1 }).limit(8),
      KYC.find().populate('userId', 'name username email mobileNumber').sort({ submittedAt: -1, createdAt: -1 }).limit(8),
      ChitMember.find().populate('userId', 'name username email mobileNumber').populate('chitId', 'name monthlyAmount weeklyAmount').sort({ joinedAt: -1, createdAt: -1 }).limit(8),
      (async () => {
        const PocketMoney = require('../models/PocketMoney');
        return await PocketMoney.find().sort({ createdAt: -1 }).limit(8);
      })(),
    ]);

    const savingRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;
    const savingCount = revenueResult.length > 0 ? revenueResult[0].count : 0;
    const pocketRevenue = pocketMoneyStatsResult.invested || 0;
    const pocketCount = pocketMoneyStatsResult.count || 0;
    const chitRevenue = chitStatsResult?.total || 0;
    const chitCount = chitStatsResult?.count || 0;

    const totalOverallRevenue = savingRevenue + pocketRevenue + chitRevenue;

    // Combine & sort all recent activities
    const combinedActivities = [
      ...recentInvestments.map(inv => ({
        _id: inv._id,
        category: 'investment',
        title: `${inv.type === 'fixed' ? 'Fixed Deposit' : 'Savings Deposit'}`,
        userName: inv.userName || 'Investor',
        userEmail: inv.userEmail || '',
        amount: inv.amount || 0,
        status: inv.status || 'pending',
        date: inv.createdAt || inv.startDate,
        details: `Ref: ${inv.referenceId || 'Direct'}`,
        targetTab: 'pending',
      })),
      ...recentWithdrawals.map(w => ({
        _id: w._id,
        category: 'withdrawal',
        title: `Withdrawal (${w.withdrawType || 'saving'})`,
        userName: w.userName || 'User',
        userEmail: w.userEmail || '',
        amount: w.amount || 0,
        status: w.status || 'pending',
        date: w.createdAt || w.date,
        details: `UPI: ${w.upiId || '—'}`,
        targetTab: 'withdrawals',
      })),
      ...recentKycs.map(k => ({
        _id: k._id,
        category: 'kyc',
        title: 'KYC Document Verification',
        userName: k.fullName || k.userId?.name || 'User',
        userEmail: k.userId?.email || k.userId?.mobileNumber || '',
        amount: null,
        status: k.status || 'pending',
        date: k.submittedAt || k.createdAt,
        details: `PAN: ${k.panNumber || '—'} • Aadhaar: ${k.aadhaarNumber ? `•••• ${k.aadhaarNumber.slice(-4)}` : '—'}`,
        targetTab: 'kyc',
      })),
      ...recentChitMembers.map(cm => ({
        _id: cm._id,
        category: 'chit',
        title: `Chit Fund: ${cm.chitId?.name || 'Chit Scheme'}`,
        userName: cm.userId?.name || cm.userId?.username || 'Member',
        userEmail: cm.userId?.email || cm.userId?.mobileNumber || '',
        amount: cm.totalPaid || cm.weeklyAmount || 0,
        status: cm.status || 'active',
        date: cm.joinedAt || cm.createdAt,
        details: `Membership: ${cm.membershipId || 'CM'} (Week ${cm.currentWeek || 1})`,
        targetTab: 'chits',
      })),
      ...recentPockets.map(pm => ({
        _id: pm._id,
        category: 'pocket',
        title: `Pocket Money (${pm.frequency || 'daily'})`,
        userName: pm.userName || 'Investor',
        userEmail: pm.userEmail || '',
        amount: pm.investedAmount || 0,
        status: pm.status || 'active',
        date: pm.startDate || pm.createdAt,
        details: `Payout: ₹${pm.payoutAmount || 0} (${pm.payoutCount || 0}/10 paid)`,
        targetTab: 'pocket',
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);

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
      revenue: savingRevenue,
      totalOverallRevenue,
      savingInvestments: {
        total: savingRevenue,
        count: savingCount,
      },
      pocketMoneyInvestments: {
        total: pocketRevenue,
        count: pocketCount,
      },
      chitInvestments: {
        total: chitRevenue,
        count: chitCount,
      },
      pocketMoney: pocketMoneyStatsResult,
      recentActivities: combinedActivities,
    });
  } catch (error) {
    console.error('Admin dashboard stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};