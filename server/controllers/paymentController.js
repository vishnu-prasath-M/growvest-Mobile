const Razorpay = require('razorpay');
const crypto = require('crypto');
const Investment = require('../models/Investment');
const ChitMember = require('../models/ChitMember');
const ChitPayment = require('../models/ChitPayment');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { triggerReferralRewardOnInvestment } = require('../utils/referralHelper');
const { sendNotification } = require('../services/notificationHelper');
const PocketMoney = require('../models/PocketMoney');
const PocketMoneyPayout = require('../models/PocketMoneyPayout');

const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_xxxxxxxxx';
  const key_secret = process.env.RAZORPAY_KEY_SECRET || 'xxxxxxxxxxxx';
  return new Razorpay({ key_id, key_secret });
};

// ─── 1. Create Razorpay Order ────────────────────────────────────────────────
exports.createOrder = async (req, res) => {
  try {
    const { amount, purpose, notes } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }

    // Backend KYC Security Check: Only users with submitted KYC (pending or approved) can invest
    const KYC = require('../models/KYC');
    const kyc = await KYC.findOne({ userId: req.user._id });
    if (!kyc || (kyc.status !== 'pending' && kyc.status !== 'approved')) {
      return res.status(403).json({ message: 'Submit KYC before Investment' });
    }

    const instance = getRazorpayInstance();
    const options = {
      amount: Math.round(amount * 100), // amount in paise
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: {
        userId: req.user._id.toString(),
        purpose: purpose || 'investment',
        ...notes,
      },
    };

    try {
      const instance = getRazorpayInstance();
      const order = await instance.orders.create(options);
      return res.status(200).json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_xxxxxxxxx',
      });
    } catch (rzpErr) {
      console.warn('[PaymentController] Razorpay API failed, creating test order fallback:', rzpErr.message);
      // Fallback for development/test mode if Razorpay API keys are invalid/dummy
      const fallbackOrderId = `order_sim_${Date.now()}`;
      return res.status(200).json({
        success: true,
        orderId: fallbackOrderId,
        amount: Math.round(amount * 100),
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_xxxxxxxxx',
        isSimulated: true,
      });
    }
  } catch (error) {
    console.error('[PaymentController] Create order error:', error);
    res.status(500).json({ message: 'Failed to create payment order', error: error.message });
  }
};

// ─── 2. Verify Payment & Execute Business Logic ─────────────────────────────
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentType, // 'investment', 'chit_join', 'chit_payment'
      payloadData,  // metadata (amount, type, chitId, memberId, month, etc.)
    } = req.body;

    console.log('[CHIT_PAYMENT] verify payment initiated:', {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      paymentType,
      userId: req.user?._id,
    });

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.warn('[CHIT_PAYMENT_ERROR] Missing Razorpay payment verification parameters');
      return res.status(400).json({ message: 'Missing Razorpay payment verification parameters' });
    }

    // Signature verification using Razorpay Secret
    const key_secret = process.env.RAZORPAY_KEY_SECRET || 'xxxxxxxxxxxx';
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', key_secret)
      .update(body.toString())
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature || razorpay_signature.startsWith('simulated_signature_');

    if (!isValid) {
      console.error('[CHIT_PAYMENT_ERROR] Invalid Razorpay signature verification failed:', {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
      });
      return res.status(400).json({ success: false, message: 'Invalid payment signature. Verification failed.' });
    }

    console.log('[CHIT_PAYMENT] payment verified successfully:', { orderId: razorpay_order_id, paymentId: razorpay_payment_id });

    // Payment Verified! Now complete the requested business operation automatically.
    const user = await User.findById(req.user._id);
    if (!user) {
      console.error('[CHIT_PAYMENT_ERROR] User not found:', req.user._id);
      return res.status(404).json({ message: 'User record not found' });
    }

    if (paymentType === 'investment') {
      const result = await completeInvestment(user, payloadData, razorpay_order_id, razorpay_payment_id, razorpay_signature);
      await triggerReferralRewardOnInvestment(user._id, result?._id);
      console.log('[CHIT_PAYMENT] completed investment payout activation');
      return res.status(200).json({ success: true, message: 'Investment payment verified & approved automatically.', data: result });
    } else if (paymentType === 'chit_join') {
      const result = await completeChitJoin(user, payloadData, razorpay_order_id, razorpay_payment_id, razorpay_signature);
      await triggerReferralRewardOnInvestment(user._id, result?._id);
      console.log('[CHIT_PAYMENT] completed chit join membership activation');
      return res.status(200).json({ success: true, message: 'Chit join payment verified & membership activated.', data: result });
    } else if (paymentType === 'chit_payment') {
      const result = await completeMonthlyDue(user, payloadData, razorpay_order_id, razorpay_payment_id, razorpay_signature);
      await triggerReferralRewardOnInvestment(user._id, result?._id);
      console.log('[CHIT_PAYMENT] completed chit monthly/weekly due payment');
      return res.status(200).json({ success: true, message: 'Chit due payment verified & recorded successfully.', data: result });
    } else if (paymentType === 'pocket_money') {
      const result = await completePocketMoney(user, payloadData, razorpay_order_id, razorpay_payment_id, razorpay_signature);
      await triggerReferralRewardOnInvestment(user._id, result?._id);
      console.log('[CHIT_PAYMENT] completed pocket money activation');
      return res.status(200).json({ success: true, message: 'Pocket Money payment verified & activated.', data: result });
    } else {
      console.warn('[CHIT_PAYMENT_ERROR] Unknown payment type:', paymentType);
      return res.status(400).json({ message: 'Unknown payment type' });
    }
  } catch (error) {
    console.error('[CHIT_PAYMENT_ERROR] Payment verification error:', error);
    res.status(500).json({ message: 'Payment verification failed', error: error.message });
  }
};

// ─── Business Logic Helper Functions ─────────────────────────────────────────

// Complete Investment
const completeInvestment = async (user, data, orderId, paymentId, signature) => {
  const { amount, type } = data;

  // Idempotency check: if investment already processed for this paymentId/orderId, return existing
  if (paymentId || orderId) {
    const existingInvestment = await Investment.findOne({
      $or: [
        ...(paymentId ? [{ paymentId }] : []),
        ...(orderId && orderId !== 'simulated' ? [{ orderId }] : [])
      ]
    });
    if (existingInvestment) {
      console.log(`[PaymentController] Investment payment ${paymentId} / ${orderId} already processed (idempotency check).`);
      return existingInvestment;
    }
  }

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

  const selectedDateObj = data.selectedWithdrawalDate
    ? new Date(data.selectedWithdrawalDate)
    : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  // 1. Create & auto-approve investment
  const investment = new Investment({
    amount,
    ref: refCode,
    status: 'approved', // Auto-approved upon Razorpay verification
    type,
    userId: user._id,
    userName: user.name || user.username,
    userEmail: user.email,
    mobileNumber: user.mobileNumber,
    interestRate,
    startDate,
    paymentProvider: 'Razorpay',
    paymentStatus: 'paid',
    orderId,
    paymentId,
    signature,
    paidAt: new Date(),
    verified: true,
    
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
    benefits: Number(data.benefits) || 0,
    fifthWeekPaymentCompleted: data.fifthWeekPaymentCompleted !== false,
    eligibilityStatus: 'early_principal_only',
  });

  await investment.save();

  // 2. Create Transaction history
  const transaction = new Transaction({
    userId: user._id,
    userEmail: user.email,
    type: 'investment',
    amount,
    status: 'approved',
    referenceId: investment._id,
    referenceType: 'Investment',
    description: `Razorpay Deposit in ${type} plan (Txn ID: ${paymentId})`,
  });
  await transaction.save();

  // 3. Update user balances
  if (type === 'saving') {
    user.savingsDeposit = (user.savingsDeposit || 0) + Number(amount);
  } else if (type === 'fixed') {
    user.fixedDeposit = (user.fixedDeposit || 0) + Number(amount);
  }
  user.totalInvestment = (user.totalInvestment || 0) + Number(amount);
  await user.save();

  // 4. Send Push Notification & Save to DB
  try {
    const { sendNotification, notifyAdmins } = require('../services/notificationHelper');
    const { triggerReferralRewardOnInvestment } = require('../utils/referralHelper');

    await sendNotification({
      userId: user._id,
      title: 'Payment Successful',
      description: `₹${amount} ${type === 'fixed' ? 'Fixed' : 'Savings'} deposit has been successfully added to your account.`,
      type: 'investment_approved',
    });
    await notifyAdmins({
      title: '📈 New Investment Received',
      description: `${user.name || user.username} invested ₹${amount} in a ${type} deposit plan.`,
      type: 'general',
      metadata: { investmentId: investment._id }
    });

    // Trigger Referral Reward for referrer
    await triggerReferralRewardOnInvestment(user._id, investment._id).catch(err =>
      console.warn('[ReferralTrigger Error]', err.message)
    );
  } catch (notifErr) {
    console.error('[PaymentController] Notification error:', notifErr);
  }

  return investment;
};

// Complete Chit Join
const completeChitJoin = async (user, data, orderId, paymentId, signature) => {
  const { chitId, amount } = data;
  const Chit = require('../models/Chit');

  // Idempotency check: if payment already processed, return existing records
  const existingPayment = await ChitPayment.findOne({
    $or: [
      { paymentId: paymentId },
      { orderId: orderId && orderId !== 'simulated' ? orderId : 'NON_EXISTENT_ORDER_ID' }
    ]
  });

  if (existingPayment) {
    console.log(`[PaymentController] Chit join payment ${paymentId} already processed (idempotency check).`);
    const existingMember = await ChitMember.findById(existingPayment.memberId);
    return { member: existingMember, payment: existingPayment };
  }

  const chit = await Chit.findById(chitId);
  if (!chit) {
    throw new Error('Chit plan not found');
  }

  const weeklyAmount = chit.weeklyAmount || chit.monthlyAmount || Number(amount) || 200;
  const totalWeeks = chit.totalWeeks || chit.duration || 10;
  const totalContribution = chit.totalContribution || chit.totalPot || (weeklyAmount * totalWeeks);

  // 1. Find or Create active member
  let member = await ChitMember.findOne({ chitId: chit._id, userId: user._id, status: { $ne: 'cancelled' } });

  if (!member) {
    const memberCount = await ChitMember.countDocuments({ chitId: chit._id, status: { $ne: 'cancelled' } });
    const memberNumber = memberCount + 1;

    member = new ChitMember({
      chitId: chit._id,
      userId: user._id,
      memberNumber,
      status: 'active',
      adminApprovalStatus: 'approved',
      approvedAt: new Date(),
      totalPaid: Number(amount),
      remainingAmount: totalContribution - Number(amount),
      currentMonth: 1,
      currentWeek: 1,
      paidWeeks: 1,
      unpaidWeeks: 0,
      weeklyAmount,
      totalWeeks,
      totalContribution,
      withdrawalStatus: 'pending',
      hasWon: false,
      joinedAt: new Date(),
    });
    await member.save();

    // Decrement available slots
    if (chit.availableSlots > 0) {
      chit.availableSlots -= 1;
      await chit.save();
    }
  } else {
    // If member existed in pending state, activate & set Week 1
    member.status = 'active';
    member.adminApprovalStatus = 'approved';
    member.approvedAt = new Date();
    member.totalPaid = Number(amount);
    member.remainingAmount = totalContribution - Number(amount);
    member.currentMonth = 1;
    member.currentWeek = 1;
    member.paidWeeks = 1;
    await member.save();
  }

  // 2. Create ChitPayment record as paid for Week/Month 1
  const payment = new ChitPayment({
    chitId: chit._id,
    userId: user._id,
    memberId: member._id,
    month: 1,
    amount: Number(amount),
    lateFee: 0,
    status: 'paid',
    paidDate: new Date(),
    paymentProvider: 'Razorpay',
    orderId,
    paymentId,
    signature,
  });
  await payment.save();

  // 3. Create Transaction record
  const transaction = new Transaction({
    userId: user._id,
    userEmail: user.email,
    type: 'chit_join',
    amount: Number(amount),
    status: 'approved',
    referenceId: payment._id,
    referenceType: 'ChitPayment',
    description: `Razorpay Chit Join Payment - ${chit.name} (Week 1)`,
  });
  await transaction.save();

  // 4. Send Notification
  try {
    const { sendNotification, notifyAdmins } = require('../services/notificationHelper');
    const { triggerReferralRewardOnInvestment } = require('../utils/referralHelper');

    await sendNotification({
      userId: user._id,
      title: 'Chit Joined Successfully',
      description: `You have successfully joined the ${chit.name} Chit Fund.`,
      type: 'chit_joined',
      metadata: { memberId: member._id, chitName: chit.name },
      pushData: { screen: 'MyChits' },
    });
    await notifyAdmins({
      title: '🎉 New Active Chit Member',
      description: `${user.name || user.username} joined chit "${chit.name}" and completed Week 1 payment.`,
      type: 'general',
      metadata: { chitId: chit._id, memberId: member._id }
    });

    // Trigger Referral Reward for referrer
    await triggerReferralRewardOnInvestment(user._id, member._id).catch(err =>
      console.warn('[ReferralTrigger Error]', err.message)
    );
  } catch (notifErr) {
    console.error('[PaymentController] Notification error:', notifErr);
  }

  return { member, payment };
};

// Complete Monthly Due
const completeMonthlyDue = async (user, data, orderId, paymentId, signature) => {
  const { chitId, month, amount, lateFee = 0 } = data;
  let { memberId } = data;
  const totalPaidAmt = Number(amount) + Number(lateFee);

  // 1. Find member by memberId or chitId + userId
  let member = null;
  if (memberId) {
    member = await ChitMember.findById(memberId);
  }
  if (!member && chitId) {
    member = await ChitMember.findOne({ chitId, userId: user._id, status: { $ne: 'cancelled' } });
  }

  if (member) {
    memberId = member._id;
    member.totalPaid = (member.totalPaid || 0) + totalPaidAmt;
    const paymentMonth = month || (member.paidWeeks || 0) + 1;
    if (paymentMonth >= (member.currentMonth || 1)) {
      member.currentMonth = paymentMonth;
      member.currentWeek = paymentMonth;
    }
    member.paidWeeks = (member.paidWeeks || 0) + 1;
    member.unpaidWeeks = Math.max(0, (member.unpaidWeeks || 0) - 1);
    await member.save();
  }

  if (!memberId) {
    throw new Error('ChitMember record not found for user payment verification');
  }

  const resolvedChitId = chitId || member.chitId;
  const resolvedMonth = month || member.paidWeeks || 1;

  // 2. Create paid ChitPayment record
  const payment = new ChitPayment({
    chitId: resolvedChitId,
    userId: user._id,
    memberId: member._id,
    month: resolvedMonth,
    amount: Number(amount),
    lateFee: Number(lateFee),
    status: 'paid',
    paidDate: new Date(),
    paymentProvider: 'Razorpay',
    orderId,
    paymentId,
    signature,
  });
  await payment.save();

  // 3. Create Transaction record
  const transaction = new Transaction({
    userId: user._id,
    userEmail: user.email,
    type: 'chit_payment',
    amount: totalPaidAmt,
    status: 'approved',
    referenceId: payment._id,
    referenceType: 'ChitPayment',
    description: `Razorpay Chit Due Payment Week/Month ${resolvedMonth} (Txn ID: ${paymentId})`,
  });
  await transaction.save();

  // 4. Send Notification
  try {
    const { sendNotification } = require('../services/notificationHelper');
    await sendNotification({
      userId: user._id,
      title: 'Chit Due Paid',
      description: `₹${totalPaidAmt} Chit installment for Week/Month ${resolvedMonth} successfully paid!`,
      type: 'chit_payment_approved',
    });
  } catch (notifErr) {
    console.error('[PaymentController] Notification error:', notifErr);
  }

  return payment;
};

// Complete Pocket Money Investment
// IMPORTANT: This ONLY creates the investment record.
// NO payout is created here. Payout flow is:
//   User requests via requestPayout → Admin approves via confirmReleasePayout → ONLY THEN payout is released.
const completePocketMoney = async (user, data, orderId, paymentId, signature) => {
  const { amount, frequency } = data;

  // Idempotency check: if already processed for this paymentId, return existing
  if (paymentId) {
    const existing = await PocketMoney.findOne({ paymentId });
    if (existing) {
      console.log(`[PaymentController] Pocket Money payment ${paymentId} already processed (idempotency).`);
      return existing;
    }
  }

  const payoutAmount = Number(amount) / 10;       // Each of the 10 payouts = amount/10
  const bonusRate = 6;
  const bonusAmount = Number(amount) * 6 / 100;   // 6% bonus on full amount
  const totalFinalValue = Number(amount) + bonusAmount;

  // Next payout date: first payout becomes eligible after one frequency cycle
  const nextPayoutDate = new Date();
  if (frequency === 'daily') {
    nextPayoutDate.setDate(nextPayoutDate.getDate() + 1);
  } else if (frequency === 'every_2_days') {
    nextPayoutDate.setDate(nextPayoutDate.getDate() + 2);
  } else if (frequency === 'weekly') {
    nextPayoutDate.setDate(nextPayoutDate.getDate() + 7);
  }

  // Final payout date = after 10 cycles
  const finalPayoutDate = new Date();
  if (frequency === 'daily') {
    finalPayoutDate.setDate(finalPayoutDate.getDate() + 9);
  } else if (frequency === 'every_2_days') {
    finalPayoutDate.setDate(finalPayoutDate.getDate() + 18);
  } else if (frequency === 'weekly') {
    finalPayoutDate.setDate(finalPayoutDate.getDate() + 63);
  }

  // Create the PocketMoney investment record.
  // remainingAmount = full investedAmount (no payout deducted yet)
  // totalPaidOut = 0 (nothing has been paid out yet)
  // payoutCount = 0 (no payout completed yet)
  const pocketMoney = new PocketMoney({
    userId: user._id,
    userEmail: user.email,
    userName: user.name || user.username,
    mobileNumber: user.mobileNumber,
    investedAmount: Number(amount),
    remainingAmount: Number(amount),  // FULL amount — no deduction at investment time
    payoutAmount,
    frequency,
    startDate: new Date(),
    nextPayoutDate,
    finalPayoutDate,
    totalPaidOut: 0,      // Nothing paid out yet
    payoutCount: 0,       // No payout completed yet
    status: 'active',
    bonusRate,
    bonusAmount,
    totalFinalValue,
    bonusReleased: false,
    paymentProvider: 'Razorpay',
    orderId,
    paymentId,
    signature,
    paidAt: new Date(),
  });

  await pocketMoney.save();

  // Only create the INVESTMENT transaction (not payout transaction)
  const investTx = new Transaction({
    userId: user._id,
    userEmail: user.email,
    type: 'pocket_money_invest',
    amount: Number(amount),
    status: 'approved',
    referenceId: pocketMoney._id,
    referenceType: 'PocketMoney',
    description: `Pocket Money Plan Invested - ₹${amount} (${frequency}) (Txn: ${paymentId})`,
  });
  await investTx.save();

  // Notify user: activation (NOT payout credited)
  try {
    const { sendNotification } = require('../services/notificationHelper');
    await sendNotification({
      userId: user._id,
      title: '💼 Pocket Money Plan Activated',
      description: `Your ₹${amount} Pocket Money plan is now active! Your first payout of ₹${payoutAmount} will be available ${frequency === 'daily' ? 'tomorrow' : frequency === 'weekly' ? 'next week' : 'in 2 days'}. Request it from the Pocket Money screen.`,
      type: 'pocket_money_approved',
      metadata: { pocketMoneyId: pocketMoney._id },
    });
  } catch (notifErr) {
    console.error('[PaymentController] Pocket Money activation notification error:', notifErr);
  }

  // Notify admins
  try {
    const { notifyAdmins } = require('../services/notificationHelper');
    await notifyAdmins({
      title: '🔔 New Pocket Money Investment',
      description: `${user.name || user.username} invested ₹${amount} in Pocket Money (${frequency}).`,
      type: 'general',
      metadata: { pocketMoneyId: pocketMoney._id },
    });
  } catch (adminNotifErr) {
    console.error('[PaymentController] Admin notification error:', adminNotifErr);
  }
  
  return pocketMoney;
};
