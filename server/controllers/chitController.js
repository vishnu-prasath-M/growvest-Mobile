const Chit = require('../models/Chit');
const ChitMember = require('../models/ChitMember');
const ChitPayment = require('../models/ChitPayment');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Settings = require('../models/Settings');

// ─── Helper ──────────────────────────────────────────────────────────────────

const calcNextDueDate = (joinedAt, currentMonth) => {
  const base = new Date(joinedAt);
  base.setMonth(base.getMonth() + currentMonth);
  base.setDate(1);
  base.setHours(0, 0, 0, 0);
  return base;
};

// ─── GET /api/chits ──────────────────────────────────────────────────────────
// @desc  Get all available chit plans (public)
// @access Public (or protected — user must be logged in)
const getAllChits = async (req, res) => {
  try {
    const chits = await Chit.find().sort({ createdAt: -1 });
    res.json(chits);
  } catch (error) {
    console.error('Error fetching all chits:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── GET /api/chits/dashboard ────────────────────────────────────────────────
// @desc  Get logged-in user's chit fund dashboard summary
// @access Private
const getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    const myMemberships = await ChitMember.find({ userId, status: 'active' })
      .populate('chitId', 'name monthlyAmount totalPot duration availableSlots status');

    const activeChits = myMemberships.length;

    let totalPaid = 0;
    let totalDividend = 0;
    let upcomingDue = 0;
    let nextDueDate = null;
    let winningStatus = 'Not Won Yet';

    myMemberships.forEach((m) => {
      totalPaid += m.totalPaid || 0;
      upcomingDue += m.chitId?.monthlyAmount || 0;

      if (m.hasWon) winningStatus = 'Won';

      const due = calcNextDueDate(m.joinedAt, m.currentMonth);
      if (!nextDueDate || due < nextDueDate) nextDueDate = due;
    });

    // Count dividends credited for this user from winner history
    const dividends = await ChitPayment.aggregate([
      { $match: { userId: req.user._id, status: 'paid' } },
      // Dividend logic placeholder — in a real scenario you'd have a separate Dividend collection
      // For now, sum lateFee fields as proxy (or set 0)
    ]);

    const availableChits = await Chit.countDocuments({
      status: { $in: ['active', 'upcoming'] },
    });

    res.json({
      activeChits: activeChits || 0,
      myJoinedChits: activeChits || 0,
      totalPaid: totalPaid || 0,
      totalDividend: totalDividend || 0,
      upcomingDue: upcomingDue || 0,
      nextDueDate: nextDueDate ? nextDueDate.toISOString().split('T')[0] : null,
      nextAuctionDate: null, // Placeholder for auction date
      winningStatus,
      availableChits: availableChits || 0,
    });
  } catch (error) {
    console.error('Error fetching chit dashboard:', error);
    // Return default values instead of error
    res.json({
      activeChits: 0,
      myJoinedChits: 0,
      totalPaid: 0,
      totalDividend: 0,
      upcomingDue: 0,
      nextDueDate: null,
      nextAuctionDate: null,
      winningStatus: 'Not Won Yet',
      availableChits: 0,
    });
  }
};

// ─── GET /api/chits/my ───────────────────────────────────────────────────────
// @desc  Get logged-in user's chit memberships
// @access Private
const getMyChits = async (req, res) => {
  try {
    const userId = req.user._id;

    const memberships = await ChitMember.find({ userId })
      .populate('chitId', 'name monthlyAmount duration totalMembers totalPot status startDate endDate features processingFee')
      .sort({ createdAt: -1 });

    const result = memberships.map((m) => {
      const chit = m.chitId;
      const progress = chit?.duration
        ? Math.round((m.currentMonth / chit.duration) * 100)
        : 0;

      const nextDueDate = m.currentMonth < (chit?.duration || 0)
        ? calcNextDueDate(m.joinedAt, m.currentMonth)
        : null;

      return {
        _id: m._id,
        chitId: chit?._id,
        chitName: chit?.name || 'Unknown',
        monthlyAmount: chit?.monthlyAmount || 0,
        duration: chit?.duration || 0,
        totalMembers: chit?.totalMembers || 0,
        totalPot: chit?.totalPot || 0,
        memberNumber: m.memberNumber,
        status: m.status,
        totalPaid: m.totalPaid,
        remainingAmount: m.remainingAmount,
        currentMonth: m.currentMonth,
        hasWon: m.hasWon,
        nextDueDate: nextDueDate ? nextDueDate.toISOString().split('T')[0] : null,
        nextDueAmount: chit?.monthlyAmount || 0,
        progress,
        joinedAt: m.joinedAt,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching my chits:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── GET /api/chits/:id ──────────────────────────────────────────────────────
// @desc  Get single chit with user's membership status
// @access Private
const getChitById = async (req, res) => {
  try {
    const chit = await Chit.findById(req.params.id);
    if (!chit) return res.status(404).json({ message: 'Chit not found' });

    // Check if logged-in user is already a member
    const membership = await ChitMember.findOne({
      chitId: req.params.id,
      userId: req.user._id,
    });

    res.json({
      ...chit.toObject(),
      myMembership: membership || null,
    });
  } catch (error) {
    console.error('Error fetching chit by id:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── GET /api/chits/:id/members ──────────────────────────────────────────────
// @desc  Get members of a chit (masked names for privacy)
// @access Private
const getChitMembers = async (req, res) => {
  try {
    const members = await ChitMember.find({ chitId: req.params.id })
      .populate('userId', 'name username')
      .sort({ memberNumber: 1 });

    const userId = req.user._id.toString();

    const result = members.map((m) => {
      const isMe = m.userId?._id?.toString() === userId;
      return {
        _id: m._id,
        memberNumber: m.memberNumber,
        status: m.status,
        hasWon: m.hasWon,
        username: isMe ? 'You' : (m.userId?.name || m.userId?.username || `Member ${m.memberNumber}`),
        isMe,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching chit members:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── POST /api/chits/join ────────────────────────────────────────────────────
// @desc  User joins a chit fund (creates pending membership + transaction)
// @access Private
const joinChit = async (req, res) => {
  try {
    const { chitId } = req.body;
    const userId = req.user._id;

    console.log('[Chit Join] User ID:', userId);
    console.log('[Chit Join] Chit ID:', chitId);

    const chit = await Chit.findById(chitId);
    if (!chit) {
      console.log('[Chit Join] Chit not found');
      return res.status(404).json({ message: 'Chit not found' });
    }

    console.log('[Chit Join] Chit found:', chit.name);
    console.log('[Chit Join] Available slots:', chit.availableSlots);
    console.log('[Chit Join] Chit status:', chit.status);

    if (chit.availableSlots <= 0) {
      console.log('[Chit Join] No available slots');
      return res.status(400).json({ message: 'No available slots in this chit' });
    }

    if (!['active', 'upcoming'].includes(chit.status)) {
      console.log('[Chit Join] Chit not accepting new members');
      return res.status(400).json({ message: 'This chit is not accepting new members' });
    }

    // Check if already a member
    const existing = await ChitMember.findOne({ chitId, userId });
    if (existing && existing.status !== 'cancelled') {
      console.log('[Chit Join] User already a member');
      return res.status(400).json({ message: 'You are already a member of this chit' });
    }

    // Assign next member number
    const memberCount = await ChitMember.countDocuments({ chitId, status: { $ne: 'cancelled' } });
    const memberNumber = memberCount + 1;

    console.log('[Chit Join] Creating member with number:', memberNumber);

    // Decrement available slots
    chit.availableSlots -= 1;
    await chit.save();

    // Create pending membership
    const member = await ChitMember.create({
      chitId,
      userId,
      memberNumber,
      status: 'pending',
      totalPaid: 0,
      remainingAmount: chit.totalPot,
      currentMonth: 0,
      hasWon: false,
      joinedAt: new Date(),
    });

    console.log('[Chit Join] Member created:', member._id);

    // Create transaction record (pending)
    const processingFeeAmount = (chit.monthlyAmount * (chit.processingFee || 0)) / 100;
    const totalPayable = chit.monthlyAmount + processingFeeAmount;

    const transaction = await Transaction.create({
      userId,
      userEmail: req.user.email || '',
      type: 'chit_join',
      amount: totalPayable,
      status: 'pending',
      referenceId: member._id,
      referenceType: 'ChitMember',
      description: `Chit Fund join request - ${chit.name} (Month 1 + processing fee)`,
    });

    console.log('[Chit Join] Transaction created:', transaction._id);

    res.status(201).json({
      member,
      transaction,
      chit: {
        _id: chit._id,
        name: chit.name,
        monthlyAmount: chit.monthlyAmount,
        processingFee: chit.processingFee,
        totalPayable,
      },
    });
  } catch (error) {
    console.error('[Chit Join] Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── POST /api/chits/payment ─────────────────────────────────────────────────
// @desc  Submit monthly payment (creates pending ChitPayment + Transaction)
// @access Private
const makePayment = async (req, res) => {
  try {
    const { chitId, memberId, month, amount, lateFee } = req.body;
    const userId = req.user._id;

    const chit = await Chit.findById(chitId);
    if (!chit) return res.status(404).json({ message: 'Chit not found' });

    const member = await ChitMember.findOne({ _id: memberId, userId });
    if (!member) return res.status(404).json({ message: 'Membership not found' });

    // Allow pending members to submit payment (join fee) and active members for monthly payments
    if (!['active', 'pending'].includes(member.status)) {
      return res.status(400).json({ message: 'Your membership is not active or pending' });
    }

    // Check if payment already exists for this month
    const existing = await ChitPayment.findOne({
      memberId,
      month,
      status: { $in: ['pending', 'paid'] },
    });
    if (existing) {
      return res.status(400).json({ message: `Payment for month ${month} already submitted` });
    }

    const fee = lateFee || 0;
    const totalAmount = amount + fee;

    // Calculate due date (1st of current month)
    const dueDate = calcNextDueDate(member.joinedAt, member.currentMonth);

    // Create pending payment
    const payment = await ChitPayment.create({
      chitId,
      userId,
      memberId,
      month,
      amount: totalAmount,
      lateFee: fee,
      status: 'pending',
      dueDate,
    });

    // Create transaction record (pending)
    const transaction = await Transaction.create({
      userId,
      userEmail: req.user.email || '',
      type: 'chit_payment',
      amount: totalAmount,
      status: 'pending',
      referenceId: payment._id,
      referenceType: 'ChitPayment',
      description: `Chit Fund payment - ${chit.name} Month ${month}`,
    });

    res.status(201).json({ payment, transaction });
  } catch (error) {
    console.error('Error submitting chit payment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── GET /api/chits/payments ─────────────────────────────────────────────────
// @desc  Get logged-in user's chit payment history
// @access Private
const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chitId } = req.query;

    const query = { userId };
    if (chitId) query.chitId = chitId;

    const payments = await ChitPayment.find(query)
      .populate('chitId', 'name monthlyAmount')
      .sort({ createdAt: -1 });

    const result = payments.map((p) => ({
      _id: p._id,
      chitId: p.chitId?._id,
      chitName: p.chitId?.name || 'Unknown',
      month: p.month,
      amount: p.amount,
      lateFee: p.lateFee,
      status: p.status,
      dueDate: p.dueDate,
      paidDate: p.paidDate,
      receiptId: p.receiptId || null,
      transactionId: p._id,
      createdAt: p.createdAt,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── GET /api/chits/winners ──────────────────────────────────────────────────
// @desc  Get winner history for a chit
// @access Private
const getWinners = async (req, res) => {
  try {
    const { chitId } = req.query;

    // Winners are members with hasWon=true
    const query = { hasWon: true };
    if (chitId) query.chitId = chitId;

    const winners = await ChitMember.find(query)
      .populate('userId', 'name username')
      .populate('chitId', 'name monthlyAmount totalPot')
      .sort({ updatedAt: -1 });

    const result = winners.map((w) => ({
      _id: w._id,
      chitName: w.chitId?.name || 'Unknown',
      user: {
        _id: w.userId?._id,
        username: w.userId?.name || w.userId?.username || 'Member',
      },
      username: w.userId?.name || w.userId?.username || 'Member',
      memberNumber: w.memberNumber,
      month: w.currentMonth || w.currentMonth,
      winningAmount: w.totalPaid,
      discount: w.chitId?.totalPot ? w.chitId.totalPot - w.totalPaid : 0,
      wonAt: w.updatedAt,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching winners:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── GET /api/chits/dividends ────────────────────────────────────────────────
// @desc  Get dividend history for logged-in user
// @access Private
const getDividends = async (req, res) => {
  try {
    // Dividend records are stored in ChitPayment as a special entry (month 0 or type dividend)
    // For now, return empty array — this can be expanded when auction/dividend logic is added
    res.json([]);
  } catch (error) {
    console.error('Error fetching dividends:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getAllChits,
  getDashboard,
  getMyChits,
  getChitById,
  getChitMembers,
  joinChit,
  makePayment,
  getPaymentHistory,
  getWinners,
  getDividends,
};
