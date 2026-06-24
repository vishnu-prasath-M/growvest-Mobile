const Transaction = require('../models/Transaction');

// @desc    Get user's transactions
// @route   GET /api/mobile/transactions
// @access  Private
const getMyTransactions = async (req, res) => {
  try {
    // Always filter by userId first (most reliable)
    const transactions = await Transaction.find({
      $or: [
        { userId: req.user._id },
        { userId: req.user.id }
      ]
    }).sort({ createdAt: -1 });

    // If no transactions found by userId, try by email as fallback
    if (transactions.length === 0 && req.user.email) {
      const emailTransactions = await Transaction.find({ 
        userEmail: req.user.email 
      }).sort({ createdAt: -1 });
      return res.json(emailTransactions);
    }

    res.json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get single transaction
// @route   GET /api/mobile/transactions/:id
// @access  Private
const getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Check if user owns this transaction
    const ownsTransaction = 
      transaction.userId?.toString() === req.user._id?.toString() ||
      transaction.userId?.toString() === req.user.id?.toString() ||
      transaction.userEmail === req.user.email;
    
    if (!ownsTransaction) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(transaction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getMyTransactions,
  getTransactionById,
};
