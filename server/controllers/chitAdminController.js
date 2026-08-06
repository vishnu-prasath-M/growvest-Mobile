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
      .populate('chitId', 'name monthlyAmount')
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
    const transactions = await Transaction.find({
      referenceType: 'ChitMember',
      status: 'pending',
    }).sort({ createdAt: -1 });

    const memberIds = transactions.map(t => t.referenceId);
    const members = await ChitMember.find({ _id: { $in: memberIds } })
      .populate('chitId', 'name monthlyAmount')
      .populate('userId', 'name username email');

    const memberMap = {};
    members.forEach(m => { memberMap[m._id.toString()] = m; });

    const result = transactions.map(t => {
      const m = memberMap[t.referenceId.toString()];
      return {
        _id: m?._id || t._id,
        chitName: m?.chitId?.name || 'Unknown',
        chitId: m?.chitId?._id,
        userName: m?.userId?.name || m?.userId?.username || 'Unknown',
        userEmail: m?.userId?.email || '',
        memberNumber: m?.memberNumber || 0,
        amount: m?.chitId?.monthlyAmount || t.amount,
        status: t.status,
        joinedAt: m?.joinedAt || t.createdAt,
        transactionId: t._id,
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
      const member = await ChitMember.findById(payment.memberId);
      if (member) {
        member.totalPaid += payment.amount;
        member.remainingAmount -= payment.amount;
        member.currentMonth += 1;
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
    const { status } = req.body;
    const member = await ChitMember.findById(req.params.id).populate('chitId');

    if (!member) {
      return res.status(404).json({ message: 'Membership not found' });
    }

    if (status === 'approved') {
      member.status = 'active';
      // totalPaid & currentMonth are updated by the ChitPayment approval — do NOT set here
      // to avoid double-counting. They are already handled by updatePaymentStatus.
      await member.save();

      // Find the existing pending ChitPayment for month 1 (created when user confirmed payment)
      const existingPayment = await ChitPayment.findOne({
        memberId: member._id,
        month: 1,
        status: 'pending',
      });

      if (existingPayment) {
        // Approve the existing payment instead of creating a new one
        existingPayment.status = 'paid';
        existingPayment.paidDate = new Date();
        existingPayment.receiptId = 'RCP' + Date.now().toString().slice(-8);
        await existingPayment.save();

        // Update member totals
        member.totalPaid = existingPayment.amount;
        member.remainingAmount = (member.chitId?.totalPot || 0) - existingPayment.amount;
        member.currentMonth = 1;
        await member.save();
      } else {
        // No pending payment found (edge case) — create one as paid
        const monthlyAmount = member.chitId?.monthlyAmount || 0;
        await ChitPayment.create({
          chitId: member.chitId?._id || member.chitId,
          userId: member.userId,
          memberId: member._id,
          month: 1,
          amount: monthlyAmount,
          status: 'paid',
          dueDate: new Date(),
          paidDate: new Date(),
          receiptId: 'RCP' + Date.now().toString().slice(-8),
        });
        member.totalPaid = monthlyAmount;
        member.remainingAmount = (member.chitId?.totalPot || 0) - monthlyAmount;
        member.currentMonth = 1;
        await member.save();
      }
    } else {
      member.status = 'cancelled';
      await member.save();

      // Restore available slot
      if (member.chitId) {
        const chitDoc = await require('../models/Chit').findById(member.chitId._id || member.chitId);
        if (chitDoc) {
          chitDoc.availableSlots += 1;
          await chitDoc.save();
        }
      }
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

    // Send unified notification (DB + Push) using the same implementation
    if (status === 'approved') {
      await sendNotification({
        userId: member.userId,
        title: '🎉 Great News!',
        description: 'Your Chit Investment has been approved. Welcome to your Chit Group.',
        type: 'chit_joined',
        metadata: { memberId: member._id, chitName: member.chitId?.name },
        pushData: { screen: 'MyChits' },
      });
    } else {
      await sendNotification({
        userId: member.userId,
        title: 'Join Request Update',
        description: `Your request to join ${member.chitId?.name || 'the chit fund'} was not approved. Contact support for details.`,
        type: 'general',
        metadata: { memberId: member._id },
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

// @desc    Create a chit (admin)
// @route   POST /api/chits
// @access  Private/Admin
const createChit = async (req, res) => {
  try {
    const chit = await Chit.create(req.body);
    // Notify all users about new chit (DB notification + push) using unified helper
    try {
      const users = await User.find({ role: 'user' });
      for (const u of users) {
        await sendNotification({
          userId: u._id,
          title: '🆕 New Chit Available',
          description: `A new Chit Plan "${chit.name}" has been added. Explore and join now!`,
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
    const chit = await Chit.findByIdAndUpdate(req.params.id, req.body, { new: true });
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