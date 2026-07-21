const Chit = require('../models/Chit');
const ChitMember = require('../models/ChitMember');
const ChitPayment = require('../models/ChitPayment');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Settings = require('../models/Settings');
const mongoose = require('mongoose');

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

    const myMemberships = await ChitMember.find({ userId })
      .populate('chitId', 'name monthlyAmount totalPot duration availableSlots status');

    const activeMemberships = myMemberships.filter(m => m.status === 'active');
    const activeChits = activeMemberships.length;
    // myJoinedChits = all memberships including pending (shows immediately after joining)
    const myJoinedChits = myMemberships.filter(m => m.status !== 'cancelled').length;

    let totalPaid = 0;
    let totalDividend = 0;
    let upcomingDue = 0;
    let pendingDueCount = 0;
    let nextDueDate = null;
    let winningStatus = 'Not Won Yet';

    myMemberships.forEach((m) => {
      totalPaid += m.totalPaid || 0;

      // Calculate how many months have elapsed since joinedAt
      const joinedDate = new Date(m.joinedAt);
      const currentDate = new Date();
      // Month difference
      const monthsElapsed = (currentDate.getFullYear() - joinedDate.getFullYear()) * 12 + 
                            (currentDate.getMonth() - joinedDate.getMonth());
      // Adjust if current day is before the join day of month
      const fullMonthsElapsed = currentDate.getDate() >= joinedDate.getDate() ? monthsElapsed : monthsElapsed - 1;
      
      // Expected paid months = fullMonthsElapsed + 1 (since first month is paid on join, or next month is due)
      // Actually, if joined Jan 15, on Jan 16: elapsed=0. Month 1 was paid. So expected = 1.
      // On Feb 15, elapsed = 1. Month 2 is due. So expected = 2.
      const expectedMonths = Math.max(0, fullMonthsElapsed + 1);
      
      const pendingInstallments = Math.max(0, expectedMonths - m.currentMonth);

      // Cap at chit duration
      const chitDuration = m.chitId?.duration || 0;
      const actualPending = Math.min(pendingInstallments, Math.max(0, chitDuration - m.currentMonth));

      // Count active memberships with remaining installments as dues
      if (m.status === 'active' && actualPending > 0) {
        upcomingDue += (m.chitId?.monthlyAmount || 0) * actualPending;
        pendingDueCount += actualPending;
      }

      if (m.hasWon) winningStatus = 'Won';

      const due = calcNextDueDate(m.joinedAt, m.currentMonth);
      if (m.status === 'active' && m.currentMonth < chitDuration) {
        if (!nextDueDate || due < nextDueDate) nextDueDate = due;
      }
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
      myJoinedChits: myJoinedChits || 0,
      totalPaid: totalPaid || 0,
      totalDividend: totalDividend || 0,
      upcomingDue: upcomingDue || 0,
      pendingDueCount: pendingDueCount || 0,
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
      pendingDueCount: 0,
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

    // Fetch all payments for this user to check which months are paid
    const allPayments = await ChitPayment.find({ userId }).lean();
    const paidMonthsByMember = {};
    allPayments.forEach(p => {
      const memberId = p.memberId?.toString();
      if (memberId) {
        if (!paidMonthsByMember[memberId]) paidMonthsByMember[memberId] = new Set();
        if (p.status === 'paid') {
          paidMonthsByMember[memberId].add(p.month);
        }
      }
    });

    const result = memberships.map((m) => {
      const chit = m.chitId;
      const progress = chit?.duration
        ? Math.round((m.currentMonth / chit.duration) * 100)
        : 0;

      const joinedDate = new Date(m.joinedAt);
      const currentDate = new Date();
      const monthsElapsed = (currentDate.getFullYear() - joinedDate.getFullYear()) * 12 + 
                            (currentDate.getMonth() - joinedDate.getMonth());
      const fullMonthsElapsed = currentDate.getDate() >= joinedDate.getDate() ? monthsElapsed : monthsElapsed - 1;
      const expectedMonths = Math.max(0, fullMonthsElapsed + 1);
      
      // Calculate pending installments excluding already paid months
      const paidMonths = paidMonthsByMember[m._id.toString()] || new Set();
      let pendingInstallments = 0;
      for (let i = m.currentMonth + 1; i <= Math.min(expectedMonths, chit?.duration || 0); i++) {
        if (!paidMonths.has(i)) {
          pendingInstallments++;
        }
      }
      const actualPending = pendingInstallments;

      const nextDueDate = m.currentMonth < (chit?.duration || 0)
        ? calcNextDueDate(m.joinedAt, m.currentMonth)
        : null;

      // Calculate due amount WITH processing fee (2% of monthly amount)
      const processingFeeAmount = (chit?.monthlyAmount || 0) * (chit?.processingFee || 0) / 100;
      const monthlyWithFee = (chit?.monthlyAmount || 0) + processingFeeAmount;
      const nextDueAmount = actualPending > 0 ? monthlyWithFee * actualPending : monthlyWithFee;

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
        nextDueAmount,
        pendingInstallments: actualPending,
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
// @desc  Get members of a chit (with real user details)
// @access Private
const getChitMembers = async (req, res) => {
  try {
    const members = await ChitMember.find({ chitId: req.params.id })
      .populate('userId', 'name username mobileNumber')
      .sort({ memberNumber: 1 });

    const userId = req.user._id.toString();

    const result = members.map((m) => {
      const isMe = m.userId?._id?.toString() === userId;
      const displayName = isMe ? 'You' : (m.userId?.name || m.userId?.username || 'Unknown');
      const avatarInitial = displayName.charAt(0).toUpperCase();
      
      return {
        _id: m._id,
        memberNumber: m.memberNumber,
        status: m.status,
        hasWon: m.hasWon,
        isMe,
        user: {
          _id: m.userId?._id,
          username: m.userId?.username || 'Unknown',
          name: m.userId?.name || m.userId?.username || 'Unknown',
          mobileNumber: m.userId?.mobileNumber,
        },
        username: displayName,
        name: displayName,
        avatarInitial,
        joinedAt: m.joinedAt,
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

    // Prevent joining closed, completed, or archived chits
    if (['closed', 'completed', 'archived'].includes(chit.status)) {
      console.log('[Chit Join] Chit is closed or completed');
      return res.status(400).json({ message: 'This chit is closed and no longer accepting new members' });
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

    const session = await mongoose.startSession();
    session.startTransaction();

    let member, transaction;
    try {
      // Decrement available slots
      chit.availableSlots -= 1;
      await chit.save({ session });

      // Create pending membership
      member = new ChitMember({
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
      await member.save({ session });

      console.log('[Chit Join] Member created:', member._id);

      // Create transaction record (pending)
      const processingFeeAmount = (chit.monthlyAmount * (chit.processingFee || 0)) / 100;
      const totalPayable = chit.monthlyAmount + processingFeeAmount;

      transaction = new Transaction({
        userId,
        userEmail: req.user.email || 'no-email@growvest.com',
        type: 'chit_join',
        amount: totalPayable,
        status: 'pending',
        referenceId: member._id,
        referenceType: 'ChitMember',
        description: `Chit Fund join request - ${chit.name} (Month 1 + processing fee)`,
      });
      await transaction.save({ session });

      await session.commitTransaction();
      session.endSession();

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
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
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

    // Prevent payments for closed, completed, or archived chits
    if (['closed', 'completed', 'archived'].includes(chit.status)) {
      return res.status(400).json({ message: 'This chit is closed and no longer accepts payments' });
    }

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

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create pending payment
      const payment = new ChitPayment({
        chitId,
        userId,
        memberId,
        month,
        amount: totalAmount,
        lateFee: fee,
        status: 'pending',
        dueDate,
      });
      await payment.save({ session });

      // Create transaction record (pending)
      const transaction = new Transaction({
        userId,
        userEmail: req.user.email || 'no-email@growvest.com',
        type: 'chit_payment',
        amount: totalAmount,
        status: 'pending',
        referenceId: payment._id,
        referenceType: 'ChitPayment',
        description: `Chit Fund payment - ${chit.name} Month ${month}`,
      });
      await transaction.save({ session });

      await session.commitTransaction();
      session.endSession();

      res.status(201).json({ payment, transaction });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
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
