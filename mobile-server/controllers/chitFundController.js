const Chit = require('../models/Chit');
const ChitMember = require('../models/ChitMember');
const ChitPayment = require('../models/ChitPayment');
const ChitAuction = require('../models/ChitAuction');
const ChitWinner = require('../models/ChitWinner');
const ChitDividend = require('../models/ChitDividend');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

// @desc    Get all available chit plans
// @route   GET /api/mobile/chits
// @access  Private
const getChits = async (req, res) => {
  try {
    const chits = await Chit.find({ status: { $in: ['active', 'upcoming'] } })
      .sort({ startDate: 1 });
    res.json(chits);
  } catch (error) {
    console.error('Error fetching chits:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get chit details by ID
// @route   GET /api/mobile/chits/:id
// @access  Private
const getChitById = async (req, res) => {
  try {
    const chit = await Chit.findById(req.params.id);
    if (!chit) {
      return res.status(404).json({ message: 'Chit not found' });
    }
    res.json(chit);
  } catch (error) {
    console.error('Error fetching chit:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user's joined chits
// @route   GET /api/mobile/chits/my
// @access  Private
const getMyChits = async (req, res) => {
  try {
    const memberships = await ChitMember.find({ userId: req.user._id })
      .populate('chitId')
      .sort({ joinedAt: -1 });

    const result = memberships.map(m => ({
      _id: m._id,
      chitId: m.chitId?._id,
      chitName: m.chitId?.name || 'Unknown',
      monthlyAmount: m.chitId?.monthlyAmount || 0,
      duration: m.chitId?.duration || 0,
      totalMembers: m.chitId?.totalMembers || 0,
      totalPot: m.chitId?.totalPot || 0,
      memberNumber: m.memberNumber,
      status: m.status,
      totalPaid: m.totalPaid,
      remainingAmount: m.remainingAmount,
      currentMonth: m.currentMonth,
      hasWon: m.hasWon,
      nextDueDate: calculateNextDueDate(m),
      nextDueAmount: m.chitId?.monthlyAmount || 0,
      progress: m.chitId?.duration > 0 ? Math.round((m.currentMonth / m.chitId.duration) * 100) : 0,
      joinedAt: m.joinedAt,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching my chits:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get dashboard summary
// @route   GET /api/mobile/chits/dashboard
// @access  Private
const getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    const memberships = await ChitMember.find({ userId, status: 'active' })
      .populate('chitId');

    const activeChits = memberships.length;
    const myJoinedChits = memberships.length;
    const totalPaid = memberships.reduce((sum, m) => sum + (m.totalPaid || 0), 0);

    // Find upcoming due
    let upcomingDue = 0;
    let nextDueDate = null;
    const now = new Date();
    for (const m of memberships) {
      if (m.chitId && m.currentMonth < m.chitId.duration) {
        const dueDate = new Date(m.chitId.startDate);
        dueDate.setMonth(dueDate.getMonth() + m.currentMonth);
        if (!nextDueDate || dueDate < nextDueDate) {
          nextDueDate = dueDate;
          upcomingDue = m.chitId.monthlyAmount || 0;
        }
      }
    }

    // Find next auction
    const nextAuction = await ChitAuction.findOne({
      chitId: { $in: memberships.map(m => m.chitId?._id).filter(Boolean) },
      status: 'upcoming',
    }).sort({ auctionDate: 1 });

    // Total dividend
    const dividends = await ChitDividend.find({ userId, status: 'credited' });
    const totalDividend = dividends.reduce((sum, d) => sum + (d.amount || 0), 0);

    // Available chits count
    const availableChits = await Chit.countDocuments({
      status: 'active',
      availableSlots: { $gt: 0 },
    });

    res.json({
      activeChits: activeChits || 0,
      myJoinedChits: myJoinedChits || 0,
      totalPaid: totalPaid || 0,
      upcomingDue: upcomingDue || 0,
      nextDueDate: nextDueDate?.toISOString().split('T')[0] || null,
      auctionStatus: nextAuction?.status || 'upcoming',
      nextAuctionDate: nextAuction?.auctionDate?.toISOString().split('T')[0] || null,
      winningStatus: memberships.some(m => m.hasWon) ? 'Won' : 'Not Won Yet',
      totalDividend: totalDividend || 0,
      availableChits: availableChits || 0,
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    // Return default values instead of error
    res.json({
      activeChits: 0,
      myJoinedChits: 0,
      totalPaid: 0,
      upcomingDue: 0,
      nextDueDate: null,
      auctionStatus: 'upcoming',
      nextAuctionDate: null,
      winningStatus: 'Not Won Yet',
      totalDividend: 0,
      availableChits: 0,
    });
  }
};

// @desc    Join a chit fund
// @route   POST /api/mobile/chits/join
// @access  Private
const joinChit = async (req, res) => {
  try {
    const { chitId } = req.body;
    const userId = req.user._id;

    const chit = await Chit.findById(chitId);
    if (!chit) {
      return res.status(404).json({ message: 'Chit not found' });
    }

    if (chit.availableSlots <= 0) {
      return res.status(400).json({ message: 'No available slots' });
    }

    // Check if already a member
    const existing = await ChitMember.findOne({ chitId, userId });
    if (existing) {
      return res.status(400).json({ message: 'Already a member of this chit' });
    }

    // Assign member number
    const memberCount = await ChitMember.countDocuments({ chitId });
    const memberNumber = memberCount + 1;

    const member = await ChitMember.create({
      chitId,
      userId,
      userEmail: req.user.email,
      memberNumber,
      status: 'active',
      totalPaid: 0,
      remainingAmount: chit.totalPot,
      currentMonth: 0,
      hasWon: false,
    });

    // Update available slots
    chit.availableSlots -= 1;
    await chit.save();

    // Create transaction record (pending - admin will approve)
    const ref = 'CHIT' + Date.now().toString().slice(-8);
    await Transaction.create({
      userId,
      userEmail: req.user.email,
      type: 'investment',
      amount: chit.monthlyAmount,
      status: 'pending',
      referenceId: member._id,
      referenceType: 'ChitMember',
      description: `Chit Fund join - ${chit.name} - ${ref}`,
    });

    res.status(201).json({
      message: 'Successfully joined chit fund',
      member,
      transactionRef: ref,
    });
  } catch (error) {
    console.error('Error joining chit:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Make a payment for chit installment
// @route   POST /api/mobile/chits/payment
// @access  Private
const makePayment = async (req, res) => {
  try {
    const { chitId, memberId, month, amount, lateFee } = req.body;
    const userId = req.user._id;

    const member = await ChitMember.findById(memberId);
    if (!member) {
      return res.status(404).json({ message: 'Membership not found' });
    }

    if (member.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const chit = await Chit.findById(chitId);
    if (!chit) {
      return res.status(404).json({ message: 'Chit not found' });
    }

    // Create payment record (pending - admin approval)
    const payment = await ChitPayment.create({
      chitId,
      userId,
      memberId,
      month,
      amount: amount || chit.monthlyAmount,
      lateFee: lateFee || 0,
      status: 'pending',
      dueDate: new Date(),
    });

    // Create transaction for admin approval
    const ref = 'CHP' + Date.now().toString().slice(-8);
    await Transaction.create({
      userId,
      userEmail: req.user.email,
      type: 'investment',
      amount: amount || chit.monthlyAmount,
      status: 'pending',
      referenceId: payment._id,
      referenceType: 'ChitPayment',
      description: `Chit Fund payment - ${chit.name} - Month ${month} - ${ref}`,
    });

    res.status(201).json({
      message: 'Payment submitted for approval',
      payment,
      transactionRef: ref,
    });
  } catch (error) {
    console.error('Error making payment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get payment history for user
// @route   GET /api/mobile/chits/payments
// @access  Private
const getPaymentHistory = async (req, res) => {
  try {
    const { chitId } = req.query;
    const filter = { userId: req.user._id };
    if (chitId) filter.chitId = chitId;

    const payments = await ChitPayment.find(filter)
      .populate('chitId', 'name')
      .sort({ month: -1 });

    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get winner history for a chit
// @route   GET /api/mobile/chits/winners
// @access  Private
const getWinners = async (req, res) => {
  try {
    const { chitId } = req.query;
    const filter = {};
    if (chitId) filter.chitId = chitId;

    const winners = await ChitWinner.find(filter)
      .populate({
        path: 'memberId',
        select: 'memberNumber',
      })
      .sort({ month: -1 });

    // Enrich with user info
    const result = await Promise.all(winners.map(async (w) => {
      const user = await User.findById(w.userId).select('name username');
      return {
        _id: w._id,
        month: w.month,
        username: user?.name || user?.username || 'Unknown',
        winningAmount: w.winningAmount,
        discount: w.discount,
        dividend: Math.round(w.discount / (w.memberId ? 1 : 1)), // placeholder
        wonAt: w.wonAt,
      };
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching winners:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get dividend history for user
// @route   GET /api/mobile/chits/dividends
// @access  Private
const getDividends = async (req, res) => {
  try {
    const dividends = await ChitDividend.find({ userId: req.user._id })
      .populate('chitId', 'name')
      .sort({ month: -1 });

    res.json(dividends);
  } catch (error) {
    console.error('Error fetching dividends:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get chit members
// @route   GET /api/mobile/chits/:id/members
// @access  Private
const getChitMembers = async (req, res) => {
  try {
    const members = await ChitMember.find({ chitId: req.params.id })
      .populate('userId', 'name username')
      .sort({ memberNumber: 1 });

    const result = members.map(m => ({
      _id: m._id,
      username: m.userId?.name || m.userId?.username || 'Unknown',
      memberNumber: m.memberNumber,
      status: m.status,
      hasWon: m.hasWon,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get auction info for a chit
// @route   GET /api/mobile/chits/:id/auction
// @access  Private
const getAuction = async (req, res) => {
  try {
    const auction = await ChitAuction.findOne({
      chitId: req.params.id,
      status: { $in: ['upcoming', 'active'] },
    }).sort({ auctionDate: 1 });

    if (!auction) {
      return res.json({ status: 'no_auction', message: 'No upcoming auction' });
    }

    res.json(auction);
  } catch (error) {
    console.error('Error fetching auction:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Helper: Calculate next due date
function calculateNextDueDate(member) {
  if (!member.chitId) return null;
  const dueDate = new Date(member.chitId.startDate);
  dueDate.setMonth(dueDate.getMonth() + member.currentMonth);
  return dueDate.toISOString().split('T')[0];
}

module.exports = {
  getChits,
  getChitById,
  getMyChits,
  getDashboard,
  joinChit,
  makePayment,
  getPaymentHistory,
  getWinners,
  getDividends,
  getChitMembers,
  getAuction,
};