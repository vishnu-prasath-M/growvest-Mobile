const Withdrawal = require('../models/Withdrawal');
const Transaction = require('../models/Transaction');

// @desc    Create new withdrawal request
// @route   POST /api/mobile/withdrawals
// @access  Private
const createWithdrawal = async (req, res) => {
  try {
    const { amount, upiId, withdrawType, userName, userEmail } = req.body;

    // Validation
    if (!amount || !upiId || !withdrawType) {
      return res.status(400).json({ message: 'Please provide amount, UPI ID, and withdrawal type' });
    }

    // Create withdrawal
    const withdrawal = await Withdrawal.create({
      userEmail: req.user.email,
      userName: userName || req.user.username,
      amount,
      upiId,
      withdrawType,
      status: 'pending',
      date: new Date().toLocaleDateString('en-IN'),
    });

    // Create transaction record
    await Transaction.create({
      userId: req.user._id,
      userEmail: req.user.email,
      type: 'withdrawal',
      amount,
      status: 'requested',
      referenceId: withdrawal._id,
      referenceType: 'Withdrawal',
      description: `Withdrawal request from ${withdrawType} deposit`,
    });

    res.status(201).json(withdrawal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user's withdrawals
// @route   GET /api/mobile/withdrawals
// @access  Private
const getMyWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ userEmail: req.user.email })
      .sort({ createdAt: -1 });

    res.json(withdrawals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get single withdrawal
// @route   GET /api/mobile/withdrawals/:id
// @access  Private
const getWithdrawalById = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);

    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal not found' });
    }

    // Check if user owns this withdrawal
    if (withdrawal.userEmail !== req.user.email) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(withdrawal);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createWithdrawal,
  getMyWithdrawals,
  getWithdrawalById,
};
