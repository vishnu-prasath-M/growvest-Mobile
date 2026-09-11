const Investment = require('../models/Investment');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { syncInvestmentInterest } = require('./userController');
const { sendNotification } = require('../services/notificationHelper');
const { calculateInvestmentTier, INVESTMENT_PLANS, DURATION_TIERS } = require('../services/investmentTierService');

exports.createInvestment = async (req, res) => {
  try {
    const { amount, type, userName, userEmail, mobileNumber } = req.body;
    const refCode = `INV-${Date.now().toString().slice(-6)}`;
    
    // Authoritative tier and interest calculation
    const tierCalc = calculateInvestmentTier({
      planType: type,
      amount: Number(amount),
      startDate: new Date(),
      intendedWithdrawalDate: req.body.intendedWithdrawalDate || req.body.selectedWithdrawalDate,
      customDays: req.body.customDays || req.body.durationDays,
    });
    
    const startDate = tierCalc.startDate;
    const maturityDate = tierCalc.maturityDate;
    const intendedWithdrawalDate = tierCalc.intendedWithdrawalDate;
    
    // 5th week / Benefit eligibility date = 35 days (5 weeks) from startDate
    const benefitEligibilityDate = new Date(startDate.getTime() + 35 * 24 * 60 * 60 * 1000);
    benefitEligibilityDate.setHours(0, 0, 0, 0);

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
      amount: tierCalc.principal,
      ref: refCode,
      status: 'approved',
      type: tierCalc.planId,
      userId: user?._id || null,
      userName: resolvedName,
      userEmail: resolvedEmail,
      mobileNumber: resolvedMobile,
      interestRate: tierCalc.applicableInterestRate,
      planInterestRate: tierCalc.maxPlanRate,
      startDate,
      
      // Duration plan fields
      planType: tierCalc.planId,
      planDurationDays: tierCalc.maxPlanDays,
      durationDays: tierCalc.eligibleHoldingDays,
      eligibleHoldingDays: tierCalc.eligibleHoldingDays,
      applicableInterestTier: tierCalc.applicableInterestTier,
      calculatedInterest: tierCalc.calculatedInterest,
      totalInterest: tierCalc.totalInterest,
      dailyInterest: tierCalc.dailyInterest,
      expectedPayout: tierCalc.expectedPayout,
      maturityAmount: tierCalc.maturityAmount,
      maturityDate,
      withdrawalStatus: 'locked',

      // Date-based withdrawal & 5-week benefit eligibility
      selectedWithdrawalDate: intendedWithdrawalDate,
      intendedWithdrawalDate,
      benefitEligibilityDate,
      benefits: Number(req.body.benefits) || 0,
      fifthWeekPaymentCompleted: req.body.fifthWeekPaymentCompleted !== false,
      eligibilityStatus: 'tier_eligible',
      interestLogicVersion: 2,
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
        description: `Investment in ${tierCalc.planName} (${tierCalc.eligibleHoldingDays} Days @ ${tierCalc.applicableInterestRate}% p.a.) - ₹${amount}`
      });
      await transaction.save();
    }

    res.status(201).json(newInvestment);
  } catch (error) {
    res.status(500).json({ message: 'Error creating investment', error: error.message });
  }
};

exports.calculateTier = async (req, res) => {
  try {
    const { planType, amount, startDate, intendedWithdrawalDate, customDays } = req.body;
    const result = calculateInvestmentTier({
      planType,
      amount: Number(amount) || 1000,
      startDate: startDate || new Date(),
      intendedWithdrawalDate,
      customDays,
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error calculating tier', error: error.message });
  }
};

exports.getPlans = async (req, res) => {
  res.status(200).json(INVESTMENT_PLANS);
};

exports.getInvestments = async (req, res) => {
  try {
    let query = { userId: req.user._id };
    if (req.user && req.user.role === 'admin' && req.query.all === 'true') {
      query = {};
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
    } else if (status === 'rejected' && investment.status !== 'rejected') {
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
          title: '❌ Investment Rejected',
          description: `Your ₹${investment.amount} ${investment.type} plan request was rejected. Please contact support if you need assistance.`,
          type: 'investment_rejected',
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

    if (investment.withdrawalStatus === 'pending') {
      return res.status(400).json({ message: 'A withdrawal request for this investment is already pending admin approval.' });
    }

    if (investment.withdrawalStatus === 'withdrawn' || investment.status === 'withdrawn') {
      return res.status(400).json({ message: 'This investment has already been withdrawn.' });
    }

    const now = new Date();
    const startDateObj = investment.startDate ? new Date(investment.startDate) : new Date();

    const durationDaysMap = {
      '15_days': 15,
      '1_month': 30,
      '3_months': 90,
      '6_months': 180,
      '1_year': 365,
      '2_years': 730,
    };
    const planDurationDays = investment.durationDays || durationDaysMap[investment.type] || 365;

    const maturityDate = investment.maturityDate
      ? new Date(investment.maturityDate)
      : new Date(startDateObj.getTime() + planDurationDays * 24 * 60 * 60 * 1000);
    maturityDate.setHours(0, 0, 0, 0);

    const intendedDate = investment.intendedWithdrawalDate
      ? new Date(investment.intendedWithdrawalDate)
      : (investment.selectedWithdrawalDate ? new Date(investment.selectedWithdrawalDate) : maturityDate);
    intendedDate.setHours(0, 0, 0, 0);

    // Lock Guard: Cannot withdraw before chosen intended withdrawal date
    if (now < intendedDate) {
      const formattedDate = intendedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      return res.status(400).json({
        message: `This investment is currently locked. Withdrawal will unlock on your chosen intended withdrawal date: ${formattedDate}.`
      });
    }

    const isFullEligible = now >= maturityDate;
    const principal = Number(investment.amount) || 0;

    let rate = Number(investment.interestRate) || 12;
    if (investment.type === '15_days')   rate = 12;
    else if (investment.type === '1_month')  rate = 15;
    else if (investment.type === '3_months') rate = 18;
    else if (investment.type === '6_months') rate = 20;
    else if (investment.type === '1_year')   rate = 24;
    else if (investment.type === 'saving')   rate = 12;
    else if (investment.type === 'fixed')    rate = 24;

    const dailyInterest = (principal * rate) / 100 / 365;
    const totalInterestForDuration = dailyInterest * planDurationDays;

    let accruedInterest = 0;
    if (investment.startDate) {
      const startDay = new Date(investment.startDate);
      startDay.setHours(0, 0, 0, 0);
      const elapsedDays = Math.max(0, Math.min(planDurationDays, Math.floor((now - startDay) / 86400000)));
      accruedInterest = elapsedDays * dailyInterest;
    }
    accruedInterest = Math.max(accruedInterest, Number(investment.interestEarned) || 0, isFullEligible ? totalInterestForDuration : 0);

    const benefits = Number(investment.benefits) || 0;
    const payoutAmount = isFullEligible ? (principal + accruedInterest + benefits) : principal;

    // Map investment type to allowed Withdrawal.withdrawType enum values
    const supportedTypes = ['saving', 'fixed', '15_days', '1_month', '3_months', '6_months', '1_year', '2_years'];
    const rawType = (investment.type || '').toLowerCase().replace(/\s/g, '_');
    const resolvedWithdrawType = supportedTypes.includes(rawType) ? rawType : 'investment';

    // Find user to ensure valid name and email
    let user = null;
    if (req.user?._id) {
      user = await User.findById(req.user._id);
    }
    if (!user && investment.userId) {
      user = await User.findById(investment.userId);
    }
    if (!user && investment.userEmail) {
      user = await User.findOne({
        $or: [{ email: investment.userEmail }, { mobileNumber: investment.userEmail }, { username: investment.userEmail }]
      });
    }

    const resolvedEmail = investment.userEmail || user?.email || user?.mobileNumber || user?.username || req.user?.email || 'user@growvest.in';
    const resolvedName = investment.userName || user?.name || user?.username || 'User';

    // STEP 1: Create withdrawal request record FIRST (so admin can see it)
    const Withdrawal = require('../models/Withdrawal');
    const withdrawal = new Withdrawal({
      userId: user?._id || req.user?._id || investment.userId,
      amount: payoutAmount,
      upiId: upiId || investment.upiId || 'Registered UPI',
      userName: resolvedName,
      userEmail: resolvedEmail,
      date: new Date().toLocaleDateString('en-IN'),
      status: 'pending',
      withdrawType: resolvedWithdrawType,
      investmentId: investment._id,
      isEarlyWithdrawal: !isFullEligible,
    });
    await withdrawal.save();

    // STEP 2: Create pending transaction record
    const transaction = new Transaction({
      userId: user?._id || req.user?._id || investment.userId,
      userEmail: resolvedEmail,
      type: 'withdrawal',
      amount: payoutAmount,
      status: 'requested',
      referenceId: withdrawal._id,
      referenceType: 'Withdrawal',
      description: isFullEligible
        ? `Full benefit withdrawal requested for ${investment.type} plan - ₹${payoutAmount}`
        : `Early principal withdrawal requested for ${investment.type} plan - ₹${payoutAmount}`,
    });
    await transaction.save();

    // STEP 3: Only after records are saved, mark investment as withdrawal pending
    // Investment stays 'approved' — only withdrawalStatus changes to 'pending'
    // It becomes 'withdrawn' only when admin marks the Withdrawal as paid
    await Investment.findByIdAndUpdate(id, {
      withdrawalStatus: 'pending',
      withdrawalRequestId: withdrawal._id,
    });

    // STEP 4: Notify admins about the withdrawal request
    try {
      const { notifyAdmins } = require('../services/notificationHelper');
      await notifyAdmins({
        title: '💸 New Investment Withdrawal Request',
        description: `${resolvedName} requested a ${isFullEligible ? 'full benefit' : 'early principal'} withdrawal of ₹${payoutAmount.toLocaleString('en-IN')} from ${investment.type} plan.`,
        type: 'general',
        metadata: { withdrawalId: withdrawal._id, investmentId: investment._id },
      });
    } catch (notifErr) {
      console.warn('[withdrawInvestment] Admin notification failed (non-fatal):', notifErr.message);
    }

    res.status(200).json({
      success: true,
      message: isFullEligible
        ? `Full benefit payout of ₹${payoutAmount.toLocaleString('en-IN')} requested. Pending admin approval.`
        : `Early principal payout of ₹${payoutAmount.toLocaleString('en-IN')} requested. Pending admin approval. Interest & benefits remain locked.`,
      withdrawal,
      payoutAmount,
      isEarlyWithdrawal: !isFullEligible,
    });
  } catch (error) {
    console.error('Error withdrawing investment:', error);
    res.status(500).json({ message: 'Error withdrawing investment', error: error.message });
  }
};

exports.reinvestInvestment = async (req, res) => {
  try {
    const sourceId = req.params?.id || req.body?.sourceInvestmentId || req.body?.investmentId;
    const { amount: clientAmount, type: requestedPlanType, selectedWithdrawalDate } = req.body || {};

    if (!sourceId) {
      return res.status(400).json({ success: false, message: 'Source investment ID is required for reinvestment.' });
    }

    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    // 1. Fetch user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // 2. Fetch source investment and verify ownership
    const sourceInvestment = await Investment.findById(sourceId);
    if (!sourceInvestment) {
      return res.status(404).json({ success: false, message: 'Source investment not found.' });
    }

    const isOwner = (sourceInvestment.userId && sourceInvestment.userId.toString() === userId.toString()) ||
                    (sourceInvestment.userEmail && user.email && sourceInvestment.userEmail.toLowerCase() === user.email.toLowerCase()) ||
                    (sourceInvestment.mobileNumber && user.mobileNumber && sourceInvestment.mobileNumber === user.mobileNumber);
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'You do not have permission to reinvest this investment.' });
    }

    // Status validation
    if (sourceInvestment.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Only approved investments can be reinvested.' });
    }

    if (sourceInvestment.status === 'withdrawn' || sourceInvestment.withdrawalStatus === 'withdrawn') {
      return res.status(400).json({ success: false, message: 'This investment has already been withdrawn.' });
    }

    if (sourceInvestment.status === 'reinvested' || sourceInvestment.withdrawalStatus === 'reinvested') {
      return res.status(400).json({ success: false, message: 'This investment has already been reinvested.' });
    }

    if (sourceInvestment.withdrawalStatus === 'pending') {
      return res.status(400).json({ success: false, message: 'A withdrawal request for this investment is currently pending admin approval.' });
    }

    // 3. Verify Server-Side Maturity
    const now = new Date();
    const startDateObj = sourceInvestment.startDate ? new Date(sourceInvestment.startDate) : new Date();

    const durationDaysMap = {
      '15_days': 15,
      '1_month': 30,
      '3_months': 90,
      '6_months': 180,
      '1_year': 365,
      '2_years': 730,
    };
    const planDurationDays = sourceInvestment.durationDays || durationDaysMap[sourceInvestment.type] || 365;

    const maturityDate = sourceInvestment.maturityDate
      ? new Date(sourceInvestment.maturityDate)
      : new Date(startDateObj.getTime() + planDurationDays * 24 * 60 * 60 * 1000);
    maturityDate.setHours(0, 0, 0, 0);

    if (now < maturityDate) {
      const formattedDate = maturityDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      return res.status(400).json({
        success: false,
        message: `This investment has not reached maturity yet. Maturity date is ${formattedDate}.`
      });
    }

    // 4. Server-Authoritative Matured Amount Calculation
    const principal = Number(sourceInvestment.amount) || 0;
    let rate = Number(sourceInvestment.interestRate) || 12;
    if (sourceInvestment.type === '15_days')   rate = 12;
    else if (sourceInvestment.type === '1_month')  rate = 15;
    else if (sourceInvestment.type === '3_months') rate = 18;
    else if (sourceInvestment.type === '6_months') rate = 20;
    else if (sourceInvestment.type === '1_year')   rate = 24;
    else if (sourceInvestment.type === 'saving')   rate = 12;
    else if (sourceInvestment.type === 'fixed')    rate = 24;

    const dailyInterest = (principal * rate) / 100 / 365;
    const totalInterestForDuration = dailyInterest * planDurationDays;

    let accruedInterest = 0;
    if (sourceInvestment.startDate) {
      const startDay = new Date(sourceInvestment.startDate);
      startDay.setHours(0, 0, 0, 0);
      const elapsedDays = Math.max(0, Math.min(planDurationDays, Math.floor((now - startDay) / 86400000)));
      accruedInterest = elapsedDays * dailyInterest;
    }
    accruedInterest = Math.max(accruedInterest, Number(sourceInvestment.interestEarned) || 0, totalInterestForDuration);

    const benefits = Number(sourceInvestment.benefits) || 0;
    const authoritativeMaturityAmount = Number((principal + accruedInterest + benefits).toFixed(2));

    if (authoritativeMaturityAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid maturity amount available for reinvestment.' });
    }

    // Validate Reinvestment Amount
    let reinvestAmount = authoritativeMaturityAmount;
    if (clientAmount && Number(clientAmount) > 0) {
      const parsedClientAmt = Number(Number(clientAmount).toFixed(2));
      if (parsedClientAmt > authoritativeMaturityAmount) {
        return res.status(400).json({
          success: false,
          message: `Reinvestment amount (₹${parsedClientAmt}) cannot exceed available matured amount (₹${authoritativeMaturityAmount}).`
        });
      }
      if (parsedClientAmt < 10) {
        return res.status(400).json({
          success: false,
          message: 'Minimum reinvestment amount is ₹10.'
        });
      }
      reinvestAmount = parsedClientAmt;
    }

    // 5. Atomic Idempotent State Transition on Source Investment
    const lockedSource = await Investment.findOneAndUpdate(
      {
        _id: sourceInvestment._id,
        status: 'approved',
        withdrawalStatus: { $nin: ['withdrawn', 'pending', 'reinvested'] }
      },
      {
        $set: {
          status: 'reinvested',
          withdrawalStatus: 'reinvested',
          reinvestedAt: new Date(),
        }
      },
      { new: true }
    );

    if (!lockedSource) {
      return res.status(400).json({
        success: false,
        message: 'Reinvestment failed: This investment is already being processed, withdrawn, or has already been reinvested.'
      });
    }

    // 6. Create the New Investment Record with Authoritative Tier Calculation
    const newPlanType = requestedPlanType || sourceInvestment.type || '1_year';
    const newStartDate = new Date();

    const tierCalc = calculateInvestmentTier({
      planType: newPlanType,
      amount: reinvestAmount,
      startDate: newStartDate,
      intendedWithdrawalDate: selectedWithdrawalDate,
    });

    const newMaturityDate = tierCalc.maturityDate;
    const newBenefitEligibilityDate = new Date(newStartDate.getTime() + 35 * 24 * 60 * 60 * 1000);
    newBenefitEligibilityDate.setHours(0, 0, 0, 0);

    const refCode = `INV-${Date.now().toString().slice(-6)}`;

    const newInvestment = new Investment({
      amount: reinvestAmount,
      ref: refCode,
      status: 'approved',
      type: tierCalc.planId,
      userId: user._id,
      userName: user.name || user.username || 'Investor',
      userEmail: user.email || '',
      mobileNumber: user.mobileNumber || '',
      interestRate: tierCalc.applicableInterestRate,
      planInterestRate: tierCalc.maxPlanRate,
      startDate: newStartDate,
      paymentProvider: 'Internal_Reinvestment',
      paymentStatus: 'paid',
      paidAt: new Date(),
      verified: true,

      // Reference linking to source
      reinvestedFrom: sourceInvestment._id,

      // Duration plan fields
      planType: tierCalc.planId,
      planDurationDays: tierCalc.maxPlanDays,
      durationDays: tierCalc.eligibleHoldingDays,
      eligibleHoldingDays: tierCalc.eligibleHoldingDays,
      applicableInterestTier: tierCalc.applicableInterestTier,
      calculatedInterest: tierCalc.calculatedInterest,
      totalInterest: tierCalc.totalInterest,
      dailyInterest: tierCalc.dailyInterest,
      expectedPayout: tierCalc.expectedPayout,
      maturityAmount: tierCalc.maturityAmount,
      maturityDate: newMaturityDate,
      withdrawalStatus: 'locked',

      selectedWithdrawalDate: tierCalc.intendedWithdrawalDate,
      intendedWithdrawalDate: tierCalc.intendedWithdrawalDate,
      benefitEligibilityDate: newBenefitEligibilityDate,
      benefits: 0,
      fifthWeekPaymentCompleted: true,
      eligibilityStatus: 'tier_eligible',
      interestLogicVersion: 2,
    });

    await newInvestment.save();

    // 7. Store reference to new investment on source investment
    await Investment.findByIdAndUpdate(sourceInvestment._id, {
      reinvestedInto: newInvestment._id
    });

    // 8. Create Transaction Record
    const sourceRef = sourceInvestment.ref || `INV-${String(sourceInvestment._id).slice(-6).toUpperCase()}`;
    const transaction = new Transaction({
      userId: user._id,
      userEmail: user.email || sourceInvestment.userEmail || '',
      type: 'investment',
      amount: reinvestAmount,
      status: 'approved',
      referenceId: newInvestment._id,
      referenceType: 'Investment',
      description: `Internal Reinvestment from Matured ${sourceRef} into ${newPlanType} (₹${reinvestAmount.toLocaleString('en-IN')})`,
    });
    await transaction.save();

    // 9. Update user total investment counters
    const principalDiff = reinvestAmount - principal;
    if (principalDiff > 0) {
      user.totalInvestment = (user.totalInvestment || 0) + principalDiff;
      await user.save();
    }

    // 10. Send User & Admin Notifications
    try {
      await sendNotification({
        userId: user._id,
        title: '🔄 Reinvestment Successful',
        description: `Your ₹${reinvestAmount.toLocaleString('en-IN')} matured payout has been successfully reinvested into ${newInvestment.planType || newPlanType} plan.`,
        type: 'investment_approved',
        metadata: { investmentId: newInvestment._id, sourceInvestmentId: sourceInvestment._id },
        pushData: { screen: 'Investments' },
      });
    } catch (notifErr) {
      console.warn('[reinvestInvestment] Notification failed (non-fatal):', notifErr.message);
    }

    return res.status(201).json({
      success: true,
      message: `Reinvestment of ₹${reinvestAmount.toLocaleString('en-IN')} successful!`,
      investment: newInvestment,
      sourceInvestmentId: sourceInvestment._id,
      reinvestedAmount: reinvestAmount,
    });
  } catch (error) {
    console.error('Error reinvesting investment:', error);
    return res.status(500).json({ success: false, message: 'Error processing reinvestment', error: error.message });
  }
};

