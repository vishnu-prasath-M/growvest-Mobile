const Transaction = require('../models/Transaction');

// Get current user transactions (using token)
exports.getMyTransactions = async (req, res) => {
  try {
    // Always filter by userId first (most reliable)
    // Fall back to userEmail only if userId is not present in some records
    const transactions = await Transaction.find({ 
      userId: req.user._id 
    }).sort({ createdAt: -1 });
    
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching your transactions', error: error.message });
  }
};

// Get all transactions
exports.getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .populate('userId', 'name email');
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching transactions', error: error.message });
  }
};

// Get transactions for specific user (by email or mobile number)
exports.getUserTransactions = async (req, res) => {
  try {
    const { userEmail } = req.params;
    // Support old users (email) and new users (mobile number)
    const transactions = await Transaction.find({
      $or: [
        { userEmail: userEmail },
        { mobileNumber: userEmail }
      ]
    })
      .sort({ createdAt: -1 })
      .populate('userId', 'name email');
    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user transactions', error: error.message });
  }
};

// Get transaction by ID
exports.getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findById(id)
      .populate('userId', 'name email');
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    
    res.status(200).json(transaction);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching transaction', error: error.message });
  }
};

// Create transaction (for manual creation if needed)
exports.createTransaction = async (req, res) => {
  try {
    const { userId, userEmail, type, amount, status, description } = req.body;
    
    const transaction = new Transaction({
      userId,
      userEmail,
      type,
      amount,
      status,
      description
    });

    await transaction.save();
    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ message: 'Error creating transaction', error: error.message });
  }
};
