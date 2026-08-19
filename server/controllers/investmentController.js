const Investment = require('../models/Investment');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { syncInvestmentInterest } = require('./userController');
const { sendNotification } = require('../services/notificationHelper');

exports.createInvestment = async (req, res) => {
  try {
    const { amount, type, userName, userEmail, mobileNumber } = req.body;
    const refCode = `INV-${Date.now().toString().slice(-6)}`;
    
    // Resolve plan parameters
    let interestRate = 12;
    let durationDays = 365;
    let planType = 'saving';
    
    if (type === 'fixed') {
      interestRate = 24;
      durationDays = 365;
      planType = 'fixed';
    } else if (type === '15_days') {
      interestRate = 12;
      durationDays = 15;
      planType = '15_days';
    } else if (type === '1_month') {
      interestRate = 15;
      durationDays = 30;
      planType = '1_month';
    } else if (type === '3_months') {
      interestRate = 18;
      durationDays = 90;
      planType = '3_months';
    } else if (type === '6_months') {
      interestRate = 20;
      durationDays = 180;
      planType = '6_months';
    } else if (type === '1_year') {
      interestRate = 24;
      durationDays = 365;
      planType = '1_year';
    }
    
    const totalInterest = Number(amount) * interestRate / 100;
    const dailyInterest = totalInterest / durationDays;
    const maturityAmount = Number(amount) + totalInterest;
    
    const startDate = new Date();
    const maturityDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

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
      startDate,
      
      // Duration plan fields
      planType,
      durationDays,
      totalInterest,
      dailyInterest,
      maturityAmount,
      maturityDate,
      withdrawalStatus: 'locked',
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
      if (inv.status === 'approved') {
        await syncInvestmentInterest(inv);
      }
      return inv;
    }));

    res.status(200).json(computedInvestments);
  } catch (error) {
    console.error('Error fetching investments:', error);
    res.status(500).json({ message: 'Error fetching investments', error: error.message });
  }
};

exports.getPlans = async (req, res) => {
  const plans = [
    { id: '15_days', name: '15 Days Plan', durationDays: 15, interestRate: 12, label: '15 Days', desc: 'Locked for 15 days, 12% returns', icon: 'clock-outline' },
    { id: '1_month', name: '1 Month Plan', durationDays: 30, interestRate: 15, label: '1 Month', desc: 'Locked for 30 days, 15% returns', icon: 'calendar' },
    { id: '3_months', name: '3 Months Plan', durationDays: 90, interestRate: 18, label: '3 Months', desc: 'Locked for 90 days, 18% returns', icon: 'calendar-range' },
    { id: '6_months', name: '6 Months Plan', durationDays: 180, interestRate: 20, label: '6 Months', desc: 'Locked for 180 days, 20% returns', icon: 'calendar-clock' },
    { id: '1_year', name: '1 Year Plan', durationDays: 365, interestRate: 24, label: '1 Year', desc: 'Locked for 365 days, 24% returns', icon: 'lock' },
  ];
  res.status(200).json(plans);
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

    const durationPlanTypes = ['15_days', '1_month', '3_months', '6_months', '1_year'];
    const isDurationPlan = durationPlanTypes.includes(investment.type);
    
    if (isDurationPlan) {
      const now = new Date();
      if (now < new Date(investment.maturityDate)) {
        return res.status(400).json({ 
          message: `Investment is locked. Withdrawal available after maturity date: ${new Date(investment.maturityDate).toLocaleDateString('en-IN')}` 
        });
      }
    }

    investment.status = 'withdrawn';
    await investment.save();

    res.status(200).json({ message: 'Withdrawal successful', investment });
  } catch (error) {
    res.status(500).json({ message: 'Error processing withdrawal', error: error.message });
  }
};
