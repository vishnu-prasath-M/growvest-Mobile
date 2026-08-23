const Chit = require('../models/Chit');
const ChitMember = require('../models/ChitMember');
const ChitPayment = require('../models/ChitPayment');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Settings = require('../models/Settings');
const mongoose = require('mongoose');
const { sendNotification } = require('../services/notificationHelper');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const calcNextDueDate = (joinedAt, currentMonth) => {
  const base = new Date(joinedAt);
  base.setMonth(base.getMonth() + currentMonth);
  base.setDate(1);
  base.setHours(0, 0, 0, 0);
  return base;
};

const calcNextWeeklyDueDate = (joinedAt, weekIndex) => {
  const base = new Date(joinedAt);
  const day = base.getDay();
  const daysToSunday = day === 0 ? 0 : 7 - day;
  const firstSunday = new Date(base.getTime() + daysToSunday * 24 * 60 * 60 * 1000);
  firstSunday.setHours(12, 0, 0, 0); // Sunday 12:00 PM due
  
  const targetDueDate = new Date(firstSunday.getTime() + (weekIndex) * 7 * 24 * 60 * 60 * 1000);
  return targetDueDate;
};

const getActionPercentage = (totalWeeks, week) => {
  if (totalWeeks === 10) {
    if (week >= 1 && week <= 4) return null;
    const schedule = {
      5: 16,
      6: 14,
      7: 12,
      8: 10,
      9: 8,
      10: 6
    };
    return schedule[week] ?? 0;
  } else if (totalWeeks === 20) {
    if (week >= 1 && week <= 9) return null;
    const schedule = {
      10: 28,
      11: 26,
      12: 24,
      13: 22,
      14: 20,
      15: 18,
      16: 16,
      17: 14,
      18: 12,
      19: 10,
      20: 8
    };
    return schedule[week] ?? 0;
  }
  return 0;
};

const generateWeeklySchedule = (weeklyAmount, totalWeeks) => {
  const totalContribution = weeklyAmount * totalWeeks;
  const schedule = [];
  
  let accumulatedDividend = 0;
  
  for (let w = 1; w <= totalWeeks; w++) {
    const actionPct = getActionPercentage(totalWeeks, w);
    
    if (actionPct === null) {
      schedule.push({
        week: w,
        weeklyPayment: weeklyAmount,
        priceAmount: null,
        dividend: null,
        actionPercentage: null,
        totalValue: null,
        isLocked: true
      });
    } else {
      const priceAmount = totalContribution - (totalContribution * actionPct / 100);
      const dividend = weeklyAmount * actionPct / 100;
      accumulatedDividend += dividend;
      const totalValue = priceAmount + accumulatedDividend;
      
      schedule.push({
        week: w,
        weeklyPayment: weeklyAmount,
        priceAmount,
        dividend,
        actionPercentage: actionPct,
        totalValue,
        isLocked: false
      });
    }
  }
  
  // Add Settlement row
  const settlementWeek = totalWeeks + 1;
  const totalDividend = totalWeeks === 10
    ? (weeklyAmount * (16+14+12+10+8+6) / 100)
    : (weeklyAmount * (28+26+24+22+20+18+16+14+12+10+8) / 100);
  const settlementAmount = totalContribution + totalDividend;
  
  schedule.push({
    week: settlementWeek,
    weeklyPayment: 0,
    priceAmount: null,
    dividend: totalDividend,
    actionPercentage: 0,
    totalValue: settlementAmount,
    isSettlement: true
  });
  
  return { schedule, totalDividend, settlementAmount };
};

// ─── GET /api/chits ──────────────────────────────────────────────────────────
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
const getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    const myMemberships = await ChitMember.find({ userId })
      .populate('chitId', 'name monthlyAmount weeklyAmount totalWeeks totalPot totalContribution duration availableSlots status isWeekly');

    const activeMemberships = myMemberships.filter(m => m.status === 'active');
    const activeChits = activeMemberships.length;
    const myJoinedChits = myMemberships.filter(m => !['cancelled', 'rejected'].includes(m.status)).length;

    let totalPaid = 0;
    let totalDividend = 0;
    let upcomingDue = 0;
    let pendingDueCount = 0;
    let nextDueDate = null;
    let winningStatus = 'Not Won Yet';

    myMemberships.forEach((m) => {
      totalPaid += m.totalPaid || 0;
      
      const isWeekly = m.chitId?.isWeekly || false;
      const joinedDate = new Date(m.joinedAt);
      const currentDate = new Date();
      
      const weeklyAmount = m.weeklyAmount || m.chitId?.weeklyAmount || m.chitId?.monthlyAmount || 0;
      const durationUnits = isWeekly 
        ? (m.totalWeeks || m.chitId?.totalWeeks || m.chitId?.duration || 10)
        : (m.totalWeeks || m.chitId?.duration || 12);
      
      const paidUnits = m.paidWeeks || m.currentWeek || m.currentMonth || 1;

      if (m.status === 'active' && paidUnits < durationUnits) {
        let expectedUnits = 0;
        if (isWeekly) {
          const diffTime = Math.abs(currentDate - joinedDate);
          const weeksElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
          expectedUnits = Math.max(1, weeksElapsed + 1);
        } else {
          const monthsElapsed = (currentDate.getFullYear() - joinedDate.getFullYear()) * 12 + 
                                (currentDate.getMonth() - joinedDate.getMonth());
          const fullMonthsElapsed = currentDate.getDate() >= joinedDate.getDate() ? monthsElapsed : monthsElapsed - 1;
          expectedUnits = Math.max(1, fullMonthsElapsed + 1);
        }

        const pendingCount = Math.max(0, expectedUnits - paidUnits);
        
        // If user has overdue pending installments, multiply by pending count.
        // If current installment is paid up to date, next due is 1 installment for the next cycle.
        const dueInstallmentCount = pendingCount > 0 ? pendingCount : 1;
        upcomingDue += weeklyAmount * dueInstallmentCount;
        pendingDueCount += Math.max(1, pendingCount);

        const due = isWeekly 
          ? calcNextWeeklyDueDate(m.joinedAt, paidUnits)
          : calcNextDueDate(m.joinedAt, paidUnits);
        if (!nextDueDate || due < nextDueDate) nextDueDate = due;
      }

      if (m.withdrawalStatus === 'completed' || m.hasWon) winningStatus = 'Won';
    });

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
      nextAuctionDate: null,
      winningStatus,
      availableChits: availableChits || 0,
    });
  } catch (error) {
    console.error('Error fetching chit dashboard:', error);
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
const getMyChits = async (req, res) => {
  try {
    const userId = req.user._id;

    const memberships = await ChitMember.find({ userId })
      .populate('chitId', 'name monthlyAmount weeklyAmount totalWeeks totalContribution duration totalMembers totalPot status startDate endDate features processingFee isWeekly')
      .sort({ createdAt: -1 });

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
      const isWeekly = chit?.isWeekly || false;
      const paidUnits = paidMonthsByMember[m._id.toString()] || new Set();
      const paidCount = paidUnits.size;
      const currentUnit = m.status === 'active' ? Math.max(1, isWeekly ? (m.currentWeek || 0) : (m.currentMonth || 0), paidCount) : 0;
      const durationUnits = isWeekly ? (chit?.totalWeeks || 0) : (chit?.duration || 0);

      const progress = durationUnits
        ? Math.round((currentUnit / durationUnits) * 100)
        : 0;

      const joinedDate = new Date(m.joinedAt || m.createdAt || Date.now());
      const currentDate = new Date();
      
      let expectedUnits = 0;
      if (isWeekly) {
        const diffTime = Math.abs(currentDate - joinedDate);
        const weeksElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
        expectedUnits = Math.max(0, weeksElapsed + 1);
      } else {
        const monthsElapsed = (currentDate.getFullYear() - joinedDate.getFullYear()) * 12 + 
                              (currentDate.getMonth() - joinedDate.getMonth());
        const fullMonthsElapsed = currentDate.getDate() >= joinedDate.getDate() ? monthsElapsed : monthsElapsed - 1;
        expectedUnits = Math.max(0, fullMonthsElapsed + 1);
      }
      
      let pendingInstallments = 0;
      for (let i = currentUnit + 1; i <= Math.min(expectedUnits, durationUnits); i++) {
        if (!paidUnits.has(i)) {
          pendingInstallments++;
        }
      }

      const nextDueDate = currentUnit < durationUnits
        ? (isWeekly ? calcNextWeeklyDueDate(m.joinedAt, currentUnit) : calcNextDueDate(m.joinedAt, currentUnit))
        : null;

      const baseAmount = isWeekly ? (chit?.weeklyAmount || 0) : (chit?.monthlyAmount || 0);
      const amountWithFee = baseAmount; // NO processing fee!
      const nextDueAmount = pendingInstallments > 0 ? amountWithFee * pendingInstallments : amountWithFee;

      const totalMembers = chit?.totalMembers || 0;
      const availableSlots = chit?.availableSlots || 0;
      const filledMembers = Math.max(0, totalMembers - availableSlots);
      const remainingInstallments = Math.max(0, durationUnits - currentUnit);
      const totalContribution = chit?.totalContribution || chit?.totalPot || (baseAmount * durationUnits);
      const totalPaid = m.status === 'active' ? Math.max(baseAmount, m.totalPaid || 0, paidCount * baseAmount) : 0;
      const remainingAmount = Math.max(0, totalContribution - totalPaid);

      return {
        _id: m._id,
        chitId: chit?._id,
        chitName: chit?.name || 'Unknown',
        monthlyAmount: baseAmount,
        weeklyAmount: chit?.weeklyAmount || 0,
        totalWeeks: chit?.totalWeeks || 0,
        isWeekly: chit?.isWeekly || false,
        duration: durationUnits,
        totalMembers,
        filledMembers,
        availableSlots,
        remainingSlots: availableSlots,
        totalPot: totalContribution,
        memberNumber: m.memberNumber,
        status: m.status,
        adminApprovalStatus: m.adminApprovalStatus || 'approved',
        rejectionReason: m.rejectionReason || '',
        totalPaid,
        remainingAmount,
        currentMonth: currentUnit,
        currentWeek: currentUnit,
        paidWeeks: currentUnit,
        unpaidWeeks: m.unpaidWeeks,
        withdrawalStatus: m.withdrawalStatus,
        withdrawalWeek: m.withdrawalWeek,
        withdrawalAmount: m.withdrawalAmount,
        installmentsPaid: currentUnit,
        remainingInstallments,
        hasWon: m.hasWon || m.withdrawalStatus === 'completed',
        winningDate: m.winningDate || m.withdrawnAt || null,
        winningAmount: m.winningAmount || m.withdrawalAmount || 0,
        winningTransactionRef: m.winningTransactionRef || null,
        nextDueDate: nextDueDate ? nextDueDate.toISOString().split('T')[0] : null,
        nextDueAmount,
        pendingInstallments,
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
const getChitById = async (req, res) => {
  try {
    const chit = await Chit.findById(req.params.id);
    if (!chit) return res.status(404).json({ message: 'Chit not found' });

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
        hasWon: m.hasWon || m.withdrawalStatus === 'completed',
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
const joinChit = async (req, res) => {
  try {
    const { chitId } = req.body;
    const userId = req.user._id;

    // Backend KYC Security Check: Only users with submitted KYC (pending or approved) can join chits
    const KYC = require('../models/KYC');
    const kyc = await KYC.findOne({ userId });
    if (!kyc || (kyc.status !== 'pending' && kyc.status !== 'approved')) {
      return res.status(403).json({ message: 'Submit KYC before Investment' });
    }

    const chit = await Chit.findById(chitId);
    if (!chit) {
      return res.status(404).json({ message: 'Chit not found' });
    }

    // Compute available slots dynamically from actual active database memberships
    const activeMembersCount = await ChitMember.countDocuments({ chitId, status: { $ne: 'cancelled' } });
    const realAvailableSlots = Math.max(0, (chit.totalMembers || 9999) - activeMembersCount);

    if (realAvailableSlots <= 0 || chit.availableSlots <= 0) {
      return res.status(400).json({ message: 'This Chit is currently full. No available slots remain.' });
    }

    if (!['active', 'upcoming'].includes(chit.status)) {
      return res.status(400).json({ message: 'This chit is not accepting new members' });
    }

    const existing = await ChitMember.findOne({ chitId, userId, status: { $ne: 'cancelled' } });
    if (existing && (existing.status === 'active' || existing.status === 'approved')) {
      return res.status(400).json({ message: 'You are already an active member of this chit' });
    }

    const baseAmount = chit.isWeekly ? (chit.weeklyAmount || chit.monthlyAmount || 200) : chit.monthlyAmount;
    const totalPayable = baseAmount; // NO processing fee!

    // Return pre-checkout confirmation data (member will be created upon payment verification)
    res.status(200).json({
      success: true,
      chit: {
        _id: chit._id,
        name: chit.name,
        monthlyAmount: baseAmount,
        weeklyAmount: chit.weeklyAmount || baseAmount,
        totalWeeks: chit.totalWeeks || chit.duration || 10,
        processingFee: 0,
        totalPayable,
      },
    });
  } catch (error) {
    console.error('[Chit Join] Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── POST /api/chits/payment ─────────────────────────────────────────────────
const makePayment = async (req, res) => {
  try {
    const { chitId, memberId, month, amount, lateFee } = req.body;
    const userId = req.user._id;

    const chit = await Chit.findById(chitId);
    if (!chit) return res.status(404).json({ message: 'Chit not found' });

    if (['closed', 'completed', 'archived'].includes(chit.status)) {
      return res.status(400).json({ message: 'This chit is closed and no longer accepts payments' });
    }

    const member = await ChitMember.findOne({ _id: memberId, userId });
    if (!member) return res.status(404).json({ message: 'Membership not found' });

    if (member.status !== 'active') {
      return res.status(400).json({ message: 'Your membership must be active (approved by admin) before making installment payments' });
    }

    const existing = await ChitPayment.findOne({
      memberId,
      month,
      status: { $in: ['pending', 'paid'] },
    });
    if (existing) {
      return res.status(400).json({ message: `Payment for week/month ${month} already submitted` });
    }

    const fee = lateFee || 0;
    const totalAmount = amount + fee;

    const dueDate = chit.isWeekly 
      ? calcNextWeeklyDueDate(member.joinedAt, month - 1)
      : calcNextDueDate(member.joinedAt, month - 1);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
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

      const transaction = new Transaction({
        userId,
        userEmail: req.user.email || 'no-email@growvest.com',
        type: 'chit_payment',
        amount: totalAmount,
        status: 'pending',
        referenceId: payment._id,
        referenceType: 'ChitPayment',
        description: `Chit Fund payment - ${chit.name} Week/Month ${month}`,
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
const getWinners = async (req, res) => {
  try {
    const { chitId } = req.query;

    const query = { $or: [{ hasWon: true }, { withdrawalStatus: 'completed' }] };
    if (chitId) query.chitId = chitId;

    const winners = await ChitMember.find(query)
      .populate('userId', 'name username')
      .populate('chitId', 'name monthlyAmount totalPot totalContribution duration totalWeeks')
      .sort({ updatedAt: -1 });

    const result = winners.map((w) => {
      const pot = w.chitId?.totalContribution || w.chitId?.totalPot || 0;
      const finalAmt = w.withdrawalAmount || w.winningAmount || 0;
      return {
        _id: w._id,
        chitName: w.chitId?.name || 'Unknown',
        user: {
          _id: w.userId?._id,
          username: w.userId?.name || w.userId?.username || 'Member',
        },
        username: w.userId?.name || w.userId?.username || 'Member',
        memberNumber: w.memberNumber,
        month: w.withdrawalWeek || w.currentWeek || w.currentMonth || 1,
        winningAmount: finalAmt,
        discount: pot ? Math.max(0, pot - finalAmt) : 0,
        wonAt: w.withdrawnAt || w.winningDate || w.updatedAt,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching winners:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── GET /api/chits/dividends ────────────────────────────────────────────────
const getDividends = async (req, res) => {
  try {
    res.json([]);
  } catch (error) {
    console.error('Error fetching dividends:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── POST /api/chits/:id/withdraw ───────────────────────────────────────────
const withdrawChitPayout = async (req, res) => {
  try {
    const memberId = req.params.id;
    const userId = req.user._id;

    const member = await ChitMember.findById(memberId).populate('chitId');
    if (!member) {
      return res.status(404).json({ message: 'Membership not found' });
    }

    if (member.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (member.status !== 'active') {
      return res.status(400).json({ message: 'Only active members can withdraw payout' });
    }

    if (member.withdrawalStatus === 'completed') {
      return res.status(400).json({ message: 'Chit Amount Already Withdrawn' });
    }

    const totalWeeks = member.totalWeeks || member.chitId.totalWeeks || member.chitId.duration || 10;
    const currentWeek = member.currentWeek || 1;
    const settlementWeek = totalWeeks + 1;

    // Check if it is a settlement or regular withdrawal
    const isSettlement = currentWeek >= settlementWeek || member.paidWeeks >= totalWeeks;

    let actionPercentage = 0;
    let priceAmount = 0;
    let accumulatedDividend = 0;
    let finalWithdrawalAmount = 0;

    const weeklyAmount = member.weeklyAmount || member.chitId.weeklyAmount || 200;
    const totalContribution = member.totalContribution || (weeklyAmount * totalWeeks);

    if (isSettlement) {
      // Settlement payout: total contribution + total dividend
      actionPercentage = 0;
      priceAmount = totalContribution;
      
      // Calculate total dividend for the entire tenure
      const { settlementAmount, totalDividend } = generateWeeklySchedule(weeklyAmount, totalWeeks);
      accumulatedDividend = totalDividend;
      finalWithdrawalAmount = settlementAmount;
    } else {
      // Normal withdrawal during the cycle
      // Check lock periods
      if (totalWeeks === 10) {
        if (currentWeek < 5) {
          return res.status(400).json({ message: 'Withdrawal locked for weeks 1–4' });
        }
      } else if (totalWeeks === 20) {
        if (currentWeek < 10) {
          return res.status(400).json({ message: 'Withdrawal locked for weeks 1–9' });
        }
      }

      actionPercentage = getActionPercentage(totalWeeks, currentWeek);
      if (actionPercentage === null) {
        return res.status(400).json({ message: 'Withdrawal not available for this week' });
      }

      priceAmount = totalContribution - (totalContribution * actionPercentage / 100);
      
      // Calculate total plan dividend
      const totalDividend = totalWeeks === 10
        ? (weeklyAmount * 66 / 100)
        : (weeklyAmount * 198 / 100);
      accumulatedDividend = totalDividend;

      finalWithdrawalAmount = priceAmount + accumulatedDividend;
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      member.withdrawalStatus = 'completed';
      member.withdrawalWeek = currentWeek;
      member.withdrawalAmount = finalWithdrawalAmount;
      member.actionPercentage = actionPercentage;
      member.priceAmount = priceAmount;
      member.accumulatedDividend = accumulatedDividend;
      member.finalWithdrawalAmount = finalWithdrawalAmount;
      member.withdrawnAt = new Date();
      member.hasWon = true;
      member.winningDate = new Date();
      member.winningAmount = finalWithdrawalAmount;
      
      if (isSettlement) {
        member.status = 'completed'; // Safe completion on settlement
      }
      await member.save({ session });

      user.balance = (user.balance || 0) + finalWithdrawalAmount;
      await user.save({ session });

      const transactionType = isSettlement ? 'chit_settlement' : 'chit_withdrawal';
      const description = isSettlement
        ? `Chit Fund Settlement - ${member.chitId.name}`
        : `Chit Fund Payout - ${member.chitId.name} Week ${currentWeek}`;

      const transaction = new Transaction({
        userId,
        userEmail: user.email || 'no-email@growvest.com',
        type: transactionType,
        amount: finalWithdrawalAmount,
        status: 'approved',
        referenceId: member._id,
        referenceType: 'ChitMember',
        description,
      });
      await transaction.save({ session });

      member.winningTransactionRef = transaction._id.toString();
      await member.save({ session });

      await session.commitTransaction();
      session.endSession();

      try {
        const notifTitle = isSettlement ? '🎉 Chit Fund Settled' : '💸 Chit Payout Completed';
        const notifDesc = isSettlement
          ? `Your Chit Fund "${member.chitId.name}" has completed. Settlement amount of ₹${finalWithdrawalAmount.toLocaleString('en-IN')} has been credited to your balance.`
          : `Your payout of ₹${finalWithdrawalAmount.toLocaleString('en-IN')} for "${member.chitId.name}" has been processed and credited to your balance.`;

        await sendNotification({
          userId,
          title: notifTitle,
          description: notifDesc,
          type: isSettlement ? 'chit_payment_approved' : 'auction_winner',
          metadata: { memberId: member._id, amount: finalWithdrawalAmount },
          pushData: { screen: 'MyChits' },
        });
      } catch (notifErr) {
        console.warn('[Chit Withdraw] Notification failed:', notifErr.message);
      }

      res.json({
        message: isSettlement ? 'Settlement processed successfully' : 'Payout processed successfully',
        member,
        transaction
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } catch (error) {
    console.error('Error in withdrawChitPayout:', error);
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
  withdrawChitPayout,
  generateWeeklySchedule,
};
