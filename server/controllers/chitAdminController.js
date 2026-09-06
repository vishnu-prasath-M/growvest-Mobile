const Chit = require('../models/Chit');
const ChitMember = require('../models/ChitMember');
const ChitPayment = require('../models/ChitPayment');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { sendNotification } = require('../services/notificationHelper');

// @desc    Get pending chit payments for admin approval
// @route   GET /api/chits/pending-payments
// @access  Private/Admin
const getPendingPayments = async (req, res) => {
  try {
    const payments = await ChitPayment.find({ status: 'pending' })
      .populate('chitId', 'name monthlyAmount isWeekly weeklyAmount totalWeeks')
      .populate('userId', 'name username email')
      .sort({ createdAt: -1 });

    const result = payments.map(p => ({
      _id: p._id,
      chitName: p.chitId?.name || 'Unknown',
      monthlyAmount: p.chitId?.monthlyAmount || 0,
      userName: p.userId?.name || p.userId?.username || 'Unknown',
      userEmail: p.userId?.email || '',
      amount: p.amount,
      month: p.month,
      lateFee: p.lateFee || 0,
      status: p.status,
      createdAt: p.createdAt,
      isWeekly: p.chitId?.isWeekly || false,
      totalWeeks: p.chitId?.totalWeeks || 0,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching pending chit payments:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get pending chit join requests
// @route   GET /api/chits/join-requests
// @access  Private/Admin
const getJoinRequests = async (req, res) => {
  try {
    // Fetch ALL non-cancelled members (pending, active, rejected) so admin can see all states
    const members = await ChitMember.find({ status: { $ne: 'cancelled' } })
      .populate('chitId', 'name monthlyAmount weeklyAmount totalWeeks duration isWeekly totalContribution totalPot processingFee')
      .populate('userId', 'name username email mobileNumber')
      .sort({ createdAt: -1 });

    const result = members.map(m => {
      const isWeekly = m.chitId?.isWeekly || false;
      const baseAmount = isWeekly ? (m.chitId?.weeklyAmount || m.chitId?.monthlyAmount || 0) : (m.chitId?.monthlyAmount || 0);
      const totalWeeks = m.chitId?.totalWeeks || m.chitId?.duration || 0;
      const totalContribution = m.chitId?.totalContribution || m.chitId?.totalPot || (baseAmount * totalWeeks);
      const processingFee = 0;
      const totalPayable = baseAmount;

      return {
        _id: m._id,
        chitName: m.chitId?.name || 'Unknown',
        chitId: m.chitId?._id,
        isWeekly,
        weeklyAmount: baseAmount,
        totalWeeks,
        totalContribution,
        processingFee: 0,
        totalPayable,
        userName: m.userId?.name || m.userId?.username || 'Unknown',
        userEmail: m.userId?.email || '',
        userPhone: m.userId?.mobileNumber || '',
        memberNumber: m.memberNumber,
        status: m.status,
        adminApprovalStatus: m.adminApprovalStatus || 'approved',
        rejectionReason: m.rejectionReason || '',
        joinedAt: m.joinedAt || m.createdAt,
        approvedAt: m.approvedAt || m.joinedAt,
        rejectedAt: m.rejectedAt || null,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching join requests:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Approve or reject a chit payment
// @route   PATCH /api/chits/payment/:id/status
// @access  Private/Admin
const updatePaymentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const payment = await ChitPayment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    payment.status = status;
    if (status === 'paid') {
      payment.paidDate = new Date();
      payment.receiptId = 'RCP' + Date.now().toString().slice(-8);

      // Update member's total paid and current month
      const member = await ChitMember.findById(payment.memberId).populate('chitId');
      if (member) {
        const isWeekly = member.chitId?.isWeekly || false;
        
        member.totalPaid += payment.amount;
        member.remainingAmount = Math.max(0, member.remainingAmount - payment.amount);
        
        if (payment.lateFee > 0) {
          member.penaltiesPaid = (member.penaltiesPaid || 0) + payment.lateFee;
          member.penaltiesUnpaid = Math.max(0, (member.penaltiesUnpaid || 0) - payment.lateFee);
        }

        if (isWeekly) {
          member.currentWeek += 1;
          member.paidWeeks += 1;
          if (member.unpaidWeeks > 0) {
            member.unpaidWeeks = Math.max(0, member.unpaidWeeks - 1);
          }
          member.currentMonth = member.currentWeek; // backward compatibility
        } else {
          member.currentMonth += 1;
        }
        await member.save();
      }
    }

    await payment.save();

    // Update transaction
    await Transaction.findOneAndUpdate(
      { referenceId: payment._id, referenceType: 'ChitPayment' },
      {
        status: status === 'paid' ? 'approved' : 'rejected',
        updatedAt: new Date(),
        description: status === 'paid'
          ? `Chit Fund payment approved - Month ${payment.month}`
          : `Chit Fund payment rejected - Month ${payment.month}`,
      },
    );

    // Send unified notification (DB + Push) using the same implementation
    if (status === 'paid') {
      await sendNotification({
        userId: payment.userId,
        title: '🎉 Good News!',
        description: 'Your Chit payment has been approved successfully.',
        type: 'chit_payment_approved',
        metadata: { paymentId: payment._id },
        pushData: { screen: 'ChitFundHome' },
      });
    } else if (status === 'rejected') {
      await sendNotification({
        userId: payment.userId,
        title: '❌ Payment Rejected',
        description: 'Your payment could not be verified. Please upload a clearer payment screenshot.',
        type: 'chit_payment_rejected',
        metadata: { paymentId: payment._id },
        pushData: { screen: 'ChitFundHome' },
      });
    }

    res.json({ message: `Payment ${status} successfully`, payment });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Approve or reject a chit join request
// @route   PATCH /api/chits/join/:id/status
// @access  Private/Admin
const updateJoinStatus = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const member = await ChitMember.findById(req.params.id).populate('chitId');

    if (!member) {
      return res.status(404).json({ message: 'Membership not found' });
    }

    // Security: prevent approving an already-approved/rejected member
    if (member.adminApprovalStatus === 'approved') {
      return res.status(400).json({ message: 'This request has already been approved' });
    }
    if (member.adminApprovalStatus === 'rejected') {
      return res.status(400).json({ message: 'This request has already been rejected' });
    }

    // Security: only pending members can be approved/rejected
    if (member.status !== 'pending') {
      return res.status(400).json({ message: `Cannot update a membership with status: ${member.status}` });
    }

    if (status === 'approved') {
      member.status = 'active';
      member.adminApprovalStatus = 'approved';
      member.approvedAt = new Date();

      // Find the existing pending ChitPayment for month/week 1 (created when user confirmed payment)
      const existingPayment = await ChitPayment.findOne({
        memberId: member._id,
        month: 1,
        status: 'pending',
      });

      const isWeekly = member.chitId?.isWeekly || false;
      const baseAmount = isWeekly ? (member.chitId?.weeklyAmount || 200) : (member.chitId?.monthlyAmount || 1000);
      const totalPotVal = isWeekly ? (member.chitId?.totalContribution || 2000) : (member.chitId?.totalPot || 20000);

      if (existingPayment) {
        existingPayment.status = 'paid';
        existingPayment.paidDate = new Date();
        existingPayment.receiptId = 'RCP' + Date.now().toString().slice(-8);
        await existingPayment.save();

        member.totalPaid = existingPayment.amount;
        member.remainingAmount = totalPotVal - existingPayment.amount;
        member.currentMonth = 1;
        member.currentWeek = 1;
        member.paidWeeks = 1;
        await member.save();
      } else {
        await ChitPayment.create({
          chitId: member.chitId?._id || member.chitId,
          userId: member.userId,
          memberId: member._id,
          month: 1,
          amount: baseAmount,
          status: 'paid',
          dueDate: new Date(),
          paidDate: new Date(),
          receiptId: 'RCP' + Date.now().toString().slice(-8),
        });
        member.totalPaid = baseAmount;
        member.remainingAmount = totalPotVal - baseAmount;
        member.currentMonth = 1;
        member.currentWeek = 1;
        member.paidWeeks = 1;
        await member.save();
      }
    } else if (status === 'rejected') {
      member.status = 'rejected';
      member.adminApprovalStatus = 'rejected';
      member.rejectedAt = new Date();
      if (rejectionReason) member.rejectionReason = rejectionReason;
      await member.save();

      // Restore available slot
      if (member.chitId) {
        const chitDoc = await require('../models/Chit').findById(member.chitId._id || member.chitId);
        if (chitDoc) {
          chitDoc.availableSlots += 1;
          await chitDoc.save();
        }
      }
    } else {
      return res.status(400).json({ message: 'Invalid status. Must be "approved" or "rejected"' });
    }

    await Transaction.findOneAndUpdate(
      { referenceId: member._id, referenceType: 'ChitMember' },
      {
        status: status === 'approved' ? 'approved' : 'rejected',
        updatedAt: new Date(),
        description: status === 'approved'
          ? `Chit Fund join approved - ${member.chitId?.name || 'Chit'}`
          : `Chit Fund join rejected - ${member.chitId?.name || 'Chit'}`,
      },
    );

    // Send notification ONLY to the specific user (not all users)
    if (status === 'approved') {
      await sendNotification({
        userId: member.userId,
        title: '✅ Chit Approved',
        description: 'Your Chit Fund request has been approved. Your Chit membership is now active.',
        type: 'chit_joined',
        metadata: { memberId: member._id, chitName: member.chitId?.name },
        pushData: { screen: 'MyChits' },
      });
    } else {
      await sendNotification({
        userId: member.userId,
        title: '❌ Chit Request Rejected',
        description: rejectionReason
          ? `Your Chit Fund request was not approved. Reason: ${rejectionReason}`
          : 'Your Chit Fund request was not approved. Please contact support for more information.',
        type: 'chit_rejected',
        metadata: { memberId: member._id, chitName: member.chitId?.name },
        pushData: { screen: 'ChitFundHome' },
      });
    }

    res.json({ message: `Join request ${status} successfully`, member });
  } catch (error) {
    console.error('Error updating join status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all chits (admin)
// @route   GET /api/chits
// @access  Private/Admin
const getAllChits = async (req, res) => {
  try {
    const chits = await Chit.find().sort({ createdAt: -1 });
    res.json(chits);
  } catch (error) {
    console.error('Error fetching all chits:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Helper to normalize chit data for weekly vs monthly
const normalizeChitData = (data) => {
  const isWeekly = data.paymentFrequency === 'monthly' ? false : (data.isWeekly !== undefined ? Boolean(data.isWeekly) : true);
  const paymentFrequency = isWeekly ? 'weekly' : 'monthly';
  const paymentDay = isWeekly ? 'Sunday' : (data.paymentDay || '1st of Month');
  
  const rawDuration = Number(data.duration || 0);
  const rawTotalWeeks = Number(data.totalWeeks || 0);
  const rawMonthlyAmount = Number(data.monthlyAmount || 0);
  const rawWeeklyAmount = Number(data.weeklyAmount || 0);

  if (isWeekly) {
    const weeks = rawDuration || rawTotalWeeks || 10;
    const baseAmt = rawWeeklyAmount || rawMonthlyAmount || 0;
    const pot = Number(data.totalPot || data.totalContribution || (baseAmt * weeks));

    return {
      ...data,
      name: data.name?.trim(),
      description: data.description || '',
      isWeekly: true,
      paymentFrequency: 'weekly',
      paymentDay: 'Sunday',
      monthlyAmount: baseAmt,
      weeklyAmount: baseAmt,
      duration: weeks,
      totalWeeks: weeks,
      totalPot: pot,
      totalContribution: pot,
      totalMembers: Number(data.totalMembers || 100),
      availableSlots: data.availableSlots !== undefined ? Number(data.availableSlots) : Number(data.totalMembers || 100),
      processingFee: Number(data.processingFee || 0),
      status: data.status || 'upcoming',
      features: Array.isArray(data.features) ? data.features : (data.features ? String(data.features).split(',').map(f => f.trim()).filter(Boolean) : []),
    };
  } else {
    const months = rawDuration || (rawTotalWeeks ? Math.round(rawTotalWeeks / 4) : 12);
    const baseAmt = rawMonthlyAmount || (rawWeeklyAmount ? rawWeeklyAmount * 4 : 0);
    const pot = Number(data.totalPot || data.totalContribution || (baseAmt * months));

    return {
      ...data,
      name: data.name?.trim(),
      description: data.description || '',
      isWeekly: false,
      paymentFrequency: 'monthly',
      paymentDay: data.paymentDay || '1st of Month',
      monthlyAmount: baseAmt,
      weeklyAmount: Math.round(baseAmt / 4),
      duration: months,
      totalWeeks: months * 4,
      totalPot: pot,
      totalContribution: pot,
      totalMembers: Number(data.totalMembers || 100),
      availableSlots: data.availableSlots !== undefined ? Number(data.availableSlots) : Number(data.totalMembers || 100),
      processingFee: Number(data.processingFee || 0),
      status: data.status || 'upcoming',
      features: Array.isArray(data.features) ? data.features : (data.features ? String(data.features).split(',').map(f => f.trim()).filter(Boolean) : []),
    };
  }
};

// @desc    Create a chit (admin)
// @route   POST /api/chits
// @access  Private/Admin
const createChit = async (req, res) => {
  try {
    const normalizedData = normalizeChitData(req.body);
    const chit = await Chit.create(normalizedData);
    // Notify all users about new chit (DB notification + push) using unified helper
    try {
      const users = await User.find({ role: 'user' });
      for (const u of users) {
        await sendNotification({
          userId: u._id,
          title: '🆕 New Chit Available',
          description: `A new ${chit.isWeekly ? 'Weekly (Sunday)' : 'Monthly'} Chit Plan "${chit.name}" has been added. Explore and join now!`,
          type: 'new_chit_available',
          metadata: { chitId: chit._id, chitName: chit.name },
          pushData: { screen: 'ExploreChits' },
        });
      }
    } catch (notifErr) {
      console.warn('Notification failed (non-fatal):', notifErr.message);
    }
    res.status(201).json(chit);
  } catch (error) {
    console.error('Error creating chit:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update a chit
// @route   PUT /api/chits/:id
// @access  Private/Admin
const updateChit = async (req, res) => {
  try {
    const normalizedData = normalizeChitData(req.body);
    const chit = await Chit.findByIdAndUpdate(req.params.id, normalizedData, { new: true });
    if (!chit) return res.status(404).json({ message: 'Chit not found' });
    res.json(chit);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete a chit
// @route   DELETE /api/chits/:id
// @access  Private/Admin
const deleteChit = async (req, res) => {
  try {
    const chit = await Chit.findById(req.params.id);
    if (!chit) return res.status(404).json({ message: 'Chit not found' });
    
    // Check if it has members
    const members = await ChitMember.countDocuments({ chitId: chit._id });
    if (members > 0) {
      return res.status(400).json({ message: 'Cannot delete chit with existing members' });
    }

    await chit.deleteOne();
    res.json({ message: 'Chit deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Change chit status (pause, resume, close, archive)
// @route   PATCH /api/chits/:id/status
// @access  Private/Admin
const changeChitStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['upcoming', 'active', 'completed', 'closed', 'paused', 'archived'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const chit = await Chit.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!chit) return res.status(404).json({ message: 'Chit not found' });

    // If chit is closed, notify all members using unified helper
    if (status === 'closed') {
      try {
        const members = await ChitMember.find({ chitId: chit._id }).populate('userId');
        for (const m of members) {
          if (m.userId) {
            await sendNotification({
              userId: m.userId._id,
              title: '🔒 Chit Closed',
              description: `The chit "${chit.name}" has been closed by admin. Thank you for participating.`,
              type: 'chit_closed',
              metadata: { chitId: chit._id, chitName: chit.name },
              pushData: { screen: 'MyChits' },
            });
          }
        }
      } catch (notifErr) {
        console.warn('Notification failed (non-fatal):', notifErr.message);
      }
    }

    res.json(chit);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// @desc    Declare auction winner for a chit month
// @route   POST /api/chits/:id/auction-winner
// @access  Private/Admin
const declareAuctionWinner = async (req, res) => {
  try {
    const { memberId, month, winningAmount } = req.body;

    if (!memberId || !month) {
      return res.status(400).json({ message: 'memberId and month are required' });
    }

    const chit = await Chit.findById(req.params.id);
    if (!chit) {
      return res.status(404).json({ message: 'Chit not found' });
    }

    const member = await ChitMember.findById(memberId).populate('userId');
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    if (member.chitId.toString() !== chit._id.toString()) {
      return res.status(400).json({ message: 'Member does not belong to this chit' });
    }

    if (member.hasWon) {
      return res.status(400).json({ message: 'This member has already won an auction' });
    }

    const prizeAmount = winningAmount ? Number(winningAmount) : chit.totalPot;

    // Mark the member as winner with winning details
    member.hasWon = true;
    member.winningDate = new Date();
    member.winningAmount = prizeAmount;
    await member.save();

    // 1. Credit winning amount to user balance in DB
    if (member.userId) {
      const winnerUser = await User.findById(member.userId._id || member.userId);
      if (winnerUser) {
        winnerUser.balance = (winnerUser.balance || 0) + prizeAmount;
        await winnerUser.save();
      }

      // 2. Create Transaction History Record
      const transaction = new Transaction({
        userId: winnerUser?._id || member.userId._id || member.userId,
        userEmail: winnerUser?.email || 'no-email@growvest.com',
        type: 'chit_winning',
        amount: prizeAmount,
        status: 'approved',
        referenceId: member._id,
        referenceType: 'ChitMember',
        description: `Chit Auction Winner Credit - ${chit.name} Month ${month}`,
      });
      await transaction.save();

      member.winningTransactionRef = transaction._id.toString();
      await member.save();

      // 3. Send unified notification (DB + Push)
      await sendNotification({
        userId: member.userId._id || member.userId,
        title: '🏆 Auction Winner!',
        description: `Congratulations! You have won the auction for "${chit.name}" in month ${month}. The winning amount of ₹${prizeAmount.toLocaleString('en-IN')} has been credited to your account!`,
        type: 'auction_winner',
        metadata: { chitId: chit._id, chitName: chit.name, memberId: member._id, month, winningAmount: prizeAmount, transactionId: transaction._id },
        pushData: { screen: 'MyChits' },
      });
    }

    res.json({ message: 'Auction winner declared and amount credited successfully', member });
  } catch (error) {
    console.error('Error declaring auction winner:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get chit dashboard overview for admin
// @route   GET /api/chits/overview
// @access  Private/Admin
const getOverview = async (req, res) => {  try {
    const pendingJoins = await Transaction.countDocuments({
      referenceType: 'ChitMember',
      status: 'pending',
    });
    const pendingPayments = await ChitPayment.countDocuments({ status: 'pending' });
    const approvedMembers = await ChitMember.countDocuments({ status: 'active' });
    const rejectedJoins = await Transaction.countDocuments({
      referenceType: 'ChitMember',
      status: 'rejected',
    });
    const rejectedPayments = await ChitPayment.countDocuments({ status: 'rejected' });
    const rejectedRequests = rejectedJoins + rejectedPayments;

    const totalChits = await Chit.countDocuments();
    const activeChits = await Chit.countDocuments({ status: 'active' });
    const closedChits = await Chit.countDocuments({ status: 'closed' });
    const completedChits = await Chit.countDocuments({ status: 'completed' });
    const totalMembers = approvedMembers;

    const totalCollected = await ChitPayment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    res.json({
      totalChits,
      activeChits,
      closedChits,
      completedChits,
      totalMembers,
      approvedMembers,
      pendingPayments,
      pendingJoins,
      rejectedRequests,
      totalCollected: totalCollected[0]?.total || 0,
    });
  } catch (error) {
    console.error('Error fetching chit overview:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getPendingPayments,
  getJoinRequests,
  updatePaymentStatus,
  updateJoinStatus,
  getAllChits,
  createChit,
  updateChit,
  deleteChit,
  changeChitStatus,
  declareAuctionWinner,
  getOverview,
};