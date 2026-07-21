const Investment = require('../models/Investment');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { syncInvestmentInterest } = require('./userController');
const { sendNotification } = require('../services/notificationHelper');

exports.createInvestment = async (req, res) => {
  try {
    const { amount, type, userName, userEmail, mobileNumber } = req.body;
    const refCode = `INV-${Date.now().toString().slice(-6)}`;
    const interestRate = type === 'fixed' ? 24 : 12;

    // Find user to store userId
    const user = await User.findOne({ 
      $or: [
        ...(userEmail ? [{ email: userEmail }] : []),
        ...(mobileNumber ? [{ mobileNumber: mobileNumber }] : [])
      ]
    });

    const newInvestment = new Investment({
      amount,
      ref: refCode,
      status: 'pending',
      type,
      userId: user?._id || null,
      userName,
      userEmail,
      mobileNumber,
      interestRate,
      startDate: new Date(),
    });

    await newInvestment.save();

    // Create transaction record (user already found above)
    if (user) {
      const transaction = new Transaction({
        userId: user._id,
        userEmail: user.email || userEmail,
        type: 'investment',
        amount,
        status: 'pending',
        referenceId: newInvestment._id,
        referenceType: 'Investment',
        description: `Investment in ${type} deposit - ₹${amount}`
      });
      await transaction.save();
    }

    res.status(201).json(newInvestment);
  } catch (error) {
    res.status(500).json({ message: 'Error creating investment', error: error.message });
  }
};

exports.getInvestments = async (req, res) => {
  try {
    const investments = await Investment.find().sort({ createdAt: -1 });

    // Calculate dynamic interest for all approved investments
    const computedInvestments = await Promise.all(investments.map(async (inv) => {
      let userName = inv.userName;
      let userEmail = inv.userEmail;

      // Logic to fix legacy data
      if (!userName || userName === "Unknown User") {
        if (userEmail) {
          const user = await User.findOne({ email: userEmail });
          if (user) {
            userName = user.name;
          }
        }
      }

      // Sync interest logic (using shared helper from userController)
      if (inv.status === 'approved') {
        await syncInvestmentInterest(inv);
      }

      return {
        ...inv.toObject(),
        userName: userName || "Unknown User",
        userEmail: userEmail || "user@example.com",
        interestEarned: inv.interestEarned || 0,
      };
    }));

    res.status(200).json(computedInvestments);
  } catch (error) {
    console.error('Error fetching investments:', error);
    res.status(500).json({ message: 'Error fetching investments', error: error.message });
  }
};

exports.updateInvestmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const investment = await Investment.findById(id);
    if (!investment) {
      return res.status(404).json({ message: 'Investment not found' });
    }

    const updatedInvestment = await Investment.findByIdAndUpdate(id, { status }, { new: true });
    
    // Update transaction record status
    await Transaction.findOneAndUpdate(
      { referenceId: investment._id, referenceType: 'Investment' },
      { 
        status: status,
        updatedAt: new Date(),
        description: status === 'approved'
          ? `Investment approved - ₹${investment.amount}`
          : status === 'rejected'
            ? `Investment rejected - ₹${investment.amount}`
            : `Investment pending review - ₹${investment.amount}`
      },
      { new: true }
    );

    // Update user balance when investment is approved
    if (status === 'approved' && investment.status !== 'approved') {
      // Support old users (email-only) and new users (mobile number)
      const user = await User.findOne({ 
        $or: [
          ...(investment.userEmail ? [{ email: investment.userEmail }] : []),
          ...(investment.mobileNumber ? [{ mobileNumber: investment.mobileNumber }] : [])
        ]
      });
      if (user) {
        // Add to user balance
        user.balance += investment.amount;
        await user.save();

        // Send unified notification (DB + Push) using the same implementation as sendWelcomeNotification
        await sendNotification({
          userId: user._id,
          title: '✅ Investment Approved',
          description: `Your ₹${investment.amount} ${investment.type} deposit investment has been approved. Your balance has been updated.`,
          type: 'investment_approved',
          metadata: { investmentId: investment._id, amount: investment.amount },
          pushData: { screen: 'Investments' },
        });
      }
    }

    res.status(200).json(updatedInvestment);
  } catch (error) {
    res.status(500).json({ message: 'Error updating investment', error: error.message });
  }
};

exports.withdrawInvestment = async (req, res) => {
  try {
    const { id } = req.params;
    const investment = await Investment.findById(id);

    if (!investment) {
      return res.status(404).json({ message: 'Investment not found' });
    }

    if (investment.status !== 'approved') {
      return res.status(400).json({ message: 'Only approved investments can be withdrawn' });
    }

    if (investment.type === 'fixed') {
      const now = new Date();
      const diffTime = Math.abs(now - investment.startDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 365) {
        return res.status(400).json({ message: 'Withdrawal available after 1 year' });
      }
    }

    investment.status = 'withdrawn';
    await investment.save();

    res.status(200).json({ message: 'Withdrawal successful', investment });
  } catch (error) {
    res.status(500).json({ message: 'Error processing withdrawal', error: error.message });
  }
};
