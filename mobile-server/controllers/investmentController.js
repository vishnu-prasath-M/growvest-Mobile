const Investment = require('../models/Investment');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

// @desc    Create new investment
// @route   POST /api/mobile/investments
// @access  Private
const createInvestment = async (req, res) => {
  try {
    const { amount, type, userName, userEmail, mobileNumber } = req.body;

    // Validation
    if (!amount || !type || !userName) {
      return res.status(400).json({ message: 'Please provide amount, type, and user name' });
    }

    // Generate reference
    const ref = 'INV' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();

    // Set interest rate based on type
    const interestRate = type === 'fixed' ? 24 : 12;

    // Create investment
    const investment = await Investment.create({
      amount,
      ref,
      type,
      userName,
      userEmail: userEmail || undefined,
      mobileNumber: mobileNumber || undefined,
      interestRate,
      status: 'pending',
    });

    // Create transaction record
    await Transaction.create({
      userId: req.user._id,
      userEmail: req.user.email,
      type: 'investment',
      amount,
      status: 'requested',
      referenceId: investment._id,
      referenceType: 'Investment',
      description: `Investment in ${type} deposit - ${ref}`,
    });

    res.status(201).json(investment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user's investments
// @route   GET /api/mobile/investments
// @access  Private
const getInvestments = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    const investments = await Investment.find({
      $or: [{ userEmail: user.email }, { mobileNumber: user.mobileNumber }]
    }).sort({ createdAt: -1 });

    res.json(investments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get single investment
// @route   GET /api/mobile/investments/:id
// @access  Private
const getInvestmentById = async (req, res) => {
  try {
    const investment = await Investment.findById(req.params.id);

    if (!investment) {
      return res.status(404).json({ message: 'Investment not found' });
    }

    // Check if user owns this investment
    const user = await User.findById(req.user._id);
    if (investment.userEmail !== user.email && investment.mobileNumber !== user.mobileNumber) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(investment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createInvestment,
  getInvestments,
  getInvestmentById,
};
