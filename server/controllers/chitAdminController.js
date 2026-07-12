const Chit = require('../models/Chit');
const ChitMember = require('../models/ChitMember');
const ChitPayment = require('../models/ChitPayment');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { sendToUser } = require('../services/pushNotificationService');

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

    // Send push notification to user
    try {
      if (status === 'paid') {
        await sendToUser(payment.userId, {
          title: '\uD83C\uDF89 Good News!',
          body: 'Your Chit payment has been approved successfully.',
          data: { type: 'chit_payment_approved', screen: 'ChitFundHome' },
        });
      } else if (status === 'rejected') {
        await sendToUser(payment.userId, {
          title: '\u274C Payment Rejected',
          body: 'Your payment could not be verified. Please upload a clearer payment screenshot.',
          data: { type: 'chit_payment_rejected', screen: 'ChitFundHome' },
        });
      }
    } catch (notifErr) {
      console.warn('Push notification failed (non-fatal):', notifErr.message);
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
      member.totalPaid = member.chitId?.monthlyAmount || 0;
      member.remainingAmount = (member.chitId?.totalPot || 0) - member.totalPaid;
      member.currentMonth = 1;
      await member.save();

      // Create first month payment as paid
      await ChitPayment.create({
        chitId: member.chitId,
        userId: member.userId,
        memberId: member._id,
        month: 1,
        amount: member.chitId?.monthlyAmount || 0,
        status: 'paid',
        dueDate: new Date(),
        paidDate: new Date(),
        receiptId: 'RCP' + Date.now().toString().slice(-8),
      });
    } else {
      member.status = 'cancelled';
      await member.save();

      // Restore available slot
      if (member.chitId) {
        member.chitId.availableSlots += 1;
        await member.chitId.save();
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

    // Send push notification to user
    try {
      if (status === 'approved') {
        await sendToUser(member.userId, {
          title: '\uD83C\uDF89 Congratulations!',
          body: 'Your Chit membership has been approved.',
          data: { type: 'chit_join_approved', screen: 'MyChits' },
        });
      } else {
        await sendToUser(member.userId, {
          title: 'Join Request Update',
          body: `Your request to join ${member.chitId?.name || 'the chit fund'} was not approved. Contact support for details.`,
          data: { type: 'chit_join_rejected', screen: 'ChitFundHome' },
        });
      }
    } catch (notifErr) {
      console.warn('Push notification failed (non-fatal):', notifErr.message);
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
    // Notify all users about new chit
    try {
      const users = await User.find({ role: 'user' });
      for (const u of users) {
        await sendToUser(u._id, {
          title: '🆕 New Chit Available',
          body: 'A new Chit Plan has been added. Explore and join now!',
          data: { type: 'new_chit', screen: 'ExploreChits' },
        });
      }
    } catch (notifErr) {
      console.warn('Push notification failed (non-fatal):', notifErr.message);
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
    res.json(chit);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// @desc    Get chit dashboard overview for admin
// @route   GET /api/chits/overview
// @access  Private/Admin
const getOverview = async (req, res) => {
  try {
    const totalChits = await Chit.countDocuments();
    const activeChits = await Chit.countDocuments({ status: 'active' });
    const totalMembers = await ChitMember.countDocuments({ status: 'active' });
    const pendingPayments = await ChitPayment.countDocuments({ status: 'pending' });
    const pendingJoins = await Transaction.countDocuments({
      referenceType: 'ChitMember',
      status: 'pending',
    });
    const totalCollected = await ChitPayment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    res.json({
      totalChits,
      activeChits,
      totalMembers,
      pendingPayments,
      pendingJoins,
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
  getOverview,
};