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
    
    const dailyInterest = (Number(amount) * interestRate) / 100 / 365;
    const totalInterest = dailyInterest * durationDays;
    const maturityAmount = Number(amount) + totalInterest;
    
    const startDate = new Date();
    const maturityDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Find user using req.user, email (case-insensitive), or mobile
    let user = null;
    if (req.user?._id || req.user?.id) {
      user = await User.findById(req.user._id || req.user.id);
    }
    if (!user && (userEmail || mobileNumber)) {
      const orConditions = [];
      if (userEmail && String(userEmail).trim() !== '' && userEmail !== 'undefined') {
        orConditions.push({ email: new RegExp(`^${String(userEmail).trim()}$`, 'i') });
      }
      if (mobileNumber && String(mobileNumber).trim() !== '' && mobileNumber !== 'undefined') {
        orConditions.push({ mobileNumber: String(mobileNumber).trim() });
      }
      if (orConditions.length > 0) {
        user = await User.findOne({ $or: orConditions });
      }
    }

    const resolvedEmail = user?.email || userEmail || '';
    const resolvedMobile = user?.mobileNumber || mobileNumber || '';
    const resolvedName = user?.name || user?.username || userName || 'Investor';

    const newInvestment = new Investment({
      amount: Number(amount),
      ref: refCode,
      status: 'approved',
      type,
      userId: user?._id || null,
      userName: resolvedName,
      userEmail: resolvedEmail,
      mobileNumber: resolvedMobile,
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

    // Link any prior orphaned investments for this user
    if (user && user._id) {
      const orphanConditions = [];
      if (user.email && user.email.trim() !== '') {
        orphanConditions.push({ userEmail: new RegExp(`^${user.email.trim()}$`, 'i') });
      }
      if (user.mobileNumber && user.mobileNumber.trim() !== '') {
        orphanConditions.push({ mobileNumber: user.mobileNumber.trim() });
      }
      if (orphanConditions.length > 0) {
        await Investment.updateMany(
          { userId: null, $or: orphanConditions },
          { $set: { userId: user._id } }
        );
      }
    }

    // Create transaction record
    if (user) {
      const transaction = new Transaction({
        userId: user._id,
        userEmail: user.email || resolvedEmail,
        type: 'investment',
        amount: Number(amount),
        status: 'approved',
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
    let query = {};
    if (req.user && req.user.role !== 'admin') {
      const userOrConditions = [{ userId: req.user._id }];
      if (req.user.email && String(req.user.email).trim() !== '' && req.user.email !== 'undefined') {
        userOrConditions.push({ userEmail: new RegExp(`^${String(req.user.email).trim()}$`, 'i') });
      }
      if (req.user.mobileNumber && String(req.user.mobileNumber).trim() !== '' && req.user.mobileNumber !== 'undefined') {
        userOrConditions.push({ mobileNumber: String(req.user.mobileNumber).trim() });
      }
      query = { $or: userOrConditions };
    } else if (req.query.all !== 'true' && req.user?._id) {
      // Even if admin, default to admin's own investments unless ?all=true is explicitly requested
      const userOrConditions = [{ userId: req.user._id }];
      if (req.user.email && String(req.user.email).trim() !== '') {
        userOrConditions.push({ userEmail: new RegExp(`^${String(req.user.email).trim()}$`, 'i') });
      }
      query = { $or: userOrConditions };
    }

    const investments = await Investment.find(query).sort({ createdAt: -1 });

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

    // When investment is approved, send notification — but do NOT touch user.balance.
    // The principal is LOCKED in the investment; balance is only credited on actual withdrawal.
    if (status === 'approved' && investment.status !== 'approved') {
      const user = await User.findOne({
        $or: [
          ...(investment.userEmail ? [{ email: investment.userEmail }] : []),
          ...(investment.userId ? [{ _id: investment.userId }] : []),
          ...(investment.mobileNumber ? [{ mobileNumber: investment.mobileNumber }] : [])
        ]
      });
      if (user) {
        await sendNotification({
          userId: user._id,
          title: '✅ Investment Approved',
          description: `Your ₹${investment.amount} ${investment.type} plan has been approved and is now locked earning interest. You can withdraw after maturity.`,
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

    if (investment.status === 'withdrawn' || investment.withdrawalStatus === 'withdrawn') {
      return res.status(400).json({ message: 'This investment has already been withdrawn' });
    }

    if (investment.status !== 'approved') {
      return res.status(400).json({ message: 'Only approved investments can be withdrawn' });
    }

    const now = new Date();
    if (investment.maturityDate && now < new Date(investment.maturityDate)) {
      const matDateStr = new Date(investment.maturityDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      return res.status(400).json({ 
        message: `Withdrawal available after maturity date: ${matDateStr}` 
      });
    }

    const maturityAmt = investment.maturityAmount || (investment.amount + (investment.totalInterest || 0));

    investment.status = 'withdrawn';
    investment.withdrawalStatus = 'withdrawn';
    await investment.save();

    // Update user balance & record transaction
    const user = await User.findById(investment.userId || req.user?._id);
    if (user) {
      user.balance = (user.balance || 0) + maturityAmt;
      await user.save();

      const transaction = new Transaction({
        userId: user._id,
        userEmail: user.email || 'user@growvest.com',
        type: 'withdrawal',
        amount: maturityAmt,
        status: 'approved',
        referenceId: investment._id,
        referenceType: 'Investment',
        description: `Investment Matured & Withdrawn (${investment.planType || investment.type}) - ₹${maturityAmt}`,
      });
      await transaction.save();

      try {
        await sendNotification({
          userId: user._id,
          title: '🎉 Investment Withdrawn',
          description: `₹${maturityAmt} has been credited to your account from your matured ${investment.planType || investment.type} plan.`,
          type: 'withdrawal_approved',
          pushData: { screen: 'Withdraw' },
        });
      } catch (notifErr) {
        console.warn('[Investment Withdrawal] Notification failed:', notifErr.message);
      }
    }

    res.status(200).json({ success: true, message: 'Withdrawal successful', investment, maturityAmount: maturityAmt });
  } catch (error) {
    console.error('Error processing investment withdrawal:', error);
    res.status(500).json({ message: 'Error processing withdrawal', error: error.message });
  }
};
