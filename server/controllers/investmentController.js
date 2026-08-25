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
    
    // 5th week / Benefit eligibility date = 35 days (5 weeks) from startDate
    const benefitEligibilityDate = new Date(startDate.getTime() + 35 * 24 * 60 * 60 * 1000);
    benefitEligibilityDate.setHours(0, 0, 0, 0);

    const selectedDateObj = req.body.selectedWithdrawalDate
      ? new Date(req.body.selectedWithdrawalDate)
      : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

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

      // Date-based withdrawal & 5-week benefit eligibility
      selectedWithdrawalDate: selectedDateObj,
      benefitEligibilityDate: benefitEligibilityDate,
      benefits: Number(req.body.benefits) || 0,
      fifthWeekPaymentCompleted: req.body.fifthWeekPaymentCompleted !== false,
      eligibilityStatus: 'early_principal_only',
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
    const { upiId } = req.body;
    const investment = await Investment.findById(id);

    if (!investment) {
      return res.status(404).json({ message: 'Investment not found' });
    }

    if (investment.status !== 'approved') {
      return res.status(400).json({ message: 'Only approved investments can be withdrawn' });
    }

    const now = new Date();
    const startDateObj = investment.startDate ? new Date(investment.startDate) : new Date();
    const benefitEligibilityDate = investment.benefitEligibilityDate
      ? new Date(investment.benefitEligibilityDate)
      : new Date(startDateObj.getTime() + 35 * 24 * 60 * 60 * 1000);
    benefitEligibilityDate.setHours(0, 0, 0, 0);

    const fifthWeekCompleted = investment.fifthWeekPaymentCompleted !== false;
    const isFullEligible = now >= benefitEligibilityDate && fifthWeekCompleted;

    const principal = Number(investment.amount) || 0;
    const accruedInterest = Number(investment.interestEarned) || Number(investment.totalInterest) || 0;
    const benefits = Number(investment.benefits) || 0;

    const payoutAmount = isFullEligible ? (principal + accruedInterest + benefits) : principal;

    investment.status = 'withdrawn';
    investment.withdrawalStatus = 'withdrawn';
    investment.eligibilityStatus = 'withdrawn';
    await investment.save();

    // Create withdrawal request record
    const Withdrawal = require('../models/Withdrawal');
    const withdrawal = new Withdrawal({
      userId: req.user?._id || investment.userId,
      amount: payoutAmount,
      upiId: upiId || 'Registered UPI',
      userName: investment.userName,
      userEmail: investment.userEmail,
      date: new Date().toLocaleDateString('en-IN'),
      status: 'pending',
      withdrawType: investment.type || 'saving'
    });
    await withdrawal.save();

    // Create transaction record
    const transaction = new Transaction({
      userId: req.user?._id || investment.userId,
      userEmail: investment.userEmail,
      type: 'withdrawal',
      amount: payoutAmount,
      status: 'pending',
      referenceId: investment._id,
      referenceType: 'Investment',
      description: isFullEligible
        ? `Full benefit withdrawal for ${investment.ref || investment.type} - ₹${payoutAmount}`
        : `Early principal withdrawal for ${investment.ref || investment.type} - ₹${payoutAmount}`
    });
    await transaction.save();

    res.status(200).json({
      success: true,
      message: isFullEligible
        ? `Full benefit payout of ₹${payoutAmount.toLocaleString('en-IN')} requested successfully.`
        : `Early principal payout of ₹${payoutAmount.toLocaleString('en-IN')} requested successfully. Interest & benefits remained locked.`,
      investment,
      payoutAmount
    });
  } catch (error) {
    console.error('Error withdrawing investment:', error);
    res.status(500).json({ message: 'Error withdrawing investment', error: error.message });
  }
};
