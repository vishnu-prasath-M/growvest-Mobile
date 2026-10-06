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
const { calculateInvestmentTier } = require('../services/investmentTierService');

// ============================================================================
// === PREVIOUS RAZORPAY GATEWAY (COMMENTED OUT AS REQUESTED) =================
// ============================================================================
/*
const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_xxxxxxxxx';
  const key_secret = process.env.RAZORPAY_KEY_SECRET || 'xxxxxxxxxxxx';
  return new Razorpay({ key_id, key_secret });
};
*/

// ============================================================================
// === NEW CUSTOM UPI / PAYME PAYMENT GATEWAY INTEGRATION =====================
// ============================================================================

/**
 * Helper to fetch gateway configuration from environment variables
 */
const getGatewayConfig = () => {
  const baseUrl = (process.env.PG_URL || process.env.PAYME_BASE_URL || process.env.PG_BASE_URL || '').trim().replace(/\/+$/, '');
  const apiKey = (process.env.PG_API_KEY || process.env.PAYME_API_KEY || '').trim();
  const isConfigured = Boolean(
    baseUrl &&
    apiKey &&
    !baseUrl.includes('yourdomain.com') &&
    apiKey !== 'your_api_key_here'
  );
  return { baseUrl, apiKey, isConfigured };
};

/**
 * Helper to call Gateway POST /api/create-order
 * All APIs use POST method with application/x-www-form-urlencoded content type
 */
const callGatewayCreateOrder = async ({ amount, orderId, mobile, redirectUrl, remark1, remark2 }) => {
  const { baseUrl, apiKey, isConfigured } = getGatewayConfig();
  if (!isConfigured) {
    return {
      success: false,
      isSimulated: true,
      message: 'Gateway credentials not configured in .env (PAYME_BASE_URL, PAYME_API_KEY); using simulation fallback.',
    };
  }

  const formParams = new URLSearchParams({
    api_key: apiKey,
    customer_mobile: String(mobile || '9999999999'),
    amount: String(amount),
    order_id: String(orderId),
    redirect_url: redirectUrl || '',
    remark1: remark1 || 'Growvest Payment',
    remark2: remark2 || '',
  });

  const url = `${baseUrl}/api/create-order`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formParams.toString(),
  });

  const data = await response.json();
  return data;
};

/**
 * Helper to call Gateway POST /api/check-order-status
 * All APIs use POST method with application/x-www-form-urlencoded content type
 */
const callGatewayCheckStatus = async (orderId) => {
  const { baseUrl, apiKey, isConfigured } = getGatewayConfig();
  if (!isConfigured) {
    return {
      status: 'SIMULATED',
      isSimulated: true,
      result: {
        txnStatus: 'COMPLETED',
        status: 'SUCCESS',
        orderId,
        utr: `SIM_UTR_${Date.now()}`,
      },
    };
  }

  const formParams = new URLSearchParams({
    api_key: apiKey,
    order_id: String(orderId),
  });

  const url = `${baseUrl}/api/check-order-status`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formParams.toString(),
  });

  const data = await response.json();
  return data;
};

// ─── 1. Create Payment Order ─────────────────────────────────────────────────
exports.createOrder = async (req, res) => {
  try {
    const { amount, purpose, notes } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }

    // KYC Check: Only enforce KYC for investment plans, never block chit dues or pocket money
    if (purpose === 'investment') {
      const KYC = require('../models/KYC');
      const kyc = await KYC.findOne({ userId: req.user._id });
      if (kyc && kyc.status === 'rejected') {
        return res.status(403).json({ message: 'Your KYC was rejected. Please re-submit KYC before investing.' });
      }
    }

    /*
    // === PREVIOUS RAZORPAY CREATE ORDER (COMMENTED OUT) ===
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
    const order = await instance.orders.create(options);
    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_xxxxxxxxx',
    });
    */

    // === NEW UPI / PAYME ORDER CREATION ===
    const user = req.user;
    const orderId = `ORD${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
    const redirectUrl = `${process.env.APP_URL || 'https://growvest-mobile.onrender.com'}/api/payment/callback`;
    const customerMobile = user?.mobileNumber || req.body?.mobileNumber || '9999999999';

    try {
      const gwRes = await callGatewayCreateOrder({
        amount: Math.round(amount),
        orderId,
        mobile: customerMobile,
        redirectUrl,
        remark1: purpose || 'Growvest',
        remark2: user?._id?.toString() || '',
      });

      if (gwRes && (gwRes.status === true || gwRes.result?.payment_url)) {
        return res.status(200).json({
          success: true,
          orderId: gwRes.result?.orderId || orderId,
          paymentUrl: gwRes.result?.payment_url,
          amount: Math.round(amount),
          currency: 'INR',
          gateway: 'custom_upi',
          isSimulated: false,
        });
      }

      console.warn('[PaymentController] Gateway returned non-success response:', gwRes);
      // If credentials not configured or live gateway not ready, provide simulated order fallback
      return res.status(200).json({
        success: true,
        orderId,
        paymentUrl: `simulated_pay_${orderId}`,
        amount: Math.round(amount),
        currency: 'INR',
        gateway: 'custom_upi',
        isSimulated: true,
        message: gwRes?.message || 'Gateway running in test simulation mode',
      });
    } catch (gwErr) {
      console.warn('[PaymentController] Gateway API call error, using test order fallback:', gwErr.message);
      return res.status(200).json({
        success: true,
        orderId,
        paymentUrl: `simulated_pay_${orderId}`,
        amount: Math.round(amount),
        currency: 'INR',
        gateway: 'custom_upi',
        isSimulated: true,
        message: 'Gateway offline or unreachable. Test simulation fallback enabled.',
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
      // New gateway parameters
      order_id,
      orderId,
      utr,
      // Backward compatibility parameters
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      // Business logic metadata
      paymentType, // 'investment', 'chit_join', 'chit_payment', 'pocket_money', 'sip_initial', 'sip_installment'
      payloadData,
      isSimulated: clientIsSimulated,
    } = req.body;

    const effectiveOrderId = order_id || orderId || razorpay_order_id;
    if (!effectiveOrderId) {
      console.warn('[CHIT_PAYMENT_ERROR] Missing order ID for verification');
      return res.status(400).json({ message: 'Order ID is required for payment verification' });
    }

    console.log('[CHIT_PAYMENT] verify payment initiated:', {
      orderId: effectiveOrderId,
      paymentType,
      userId: req.user?._id,
    });

    /*
    // === PREVIOUS RAZORPAY SIGNATURE VERIFICATION (COMMENTED OUT) ===
    const key_secret = process.env.RAZORPAY_KEY_SECRET || 'xxxxxxxxxxxx';
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', key_secret)
      .update(body.toString())
      .digest('hex');
    const isValid = expectedSignature === razorpay_signature || razorpay_signature.startsWith('simulated_signature_');
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature. Verification failed.' });
    }
    */

    // === NEW UPI / PAYME VERIFICATION ===
    let verifiedUtr = utr || razorpay_payment_id || `UTR_${Date.now()}`;
    const isSimulated =
      clientIsSimulated ||
      effectiveOrderId.startsWith('order_sim_') ||
      effectiveOrderId.startsWith('ORD_SIM_') ||
      (razorpay_signature && razorpay_signature.startsWith('simulated_'));

    if (!isSimulated) {
      const statusRes = await callGatewayCheckStatus(effectiveOrderId);
      console.log('[PaymentController] Gateway status check result:', statusRes);

      const status = (
        statusRes?.status ||
        statusRes?.result?.status ||
        statusRes?.result?.txnStatus ||
        ''
      ).toUpperCase();

      if (status === 'COMPLETED' || status === 'SUCCESS') {
        verifiedUtr = statusRes?.result?.utr || verifiedUtr;
      } else if (status === 'PENDING') {
        return res.status(200).json({
          success: false,
          isPending: true,
          message: 'Payment is still pending. If you just completed the payment, please wait a few seconds and tap verify again.',
        });
      } else if (status === 'FAILED') {
        return res.status(400).json({
          success: false,
          isFailed: true,
          message: statusRes?.message || 'Payment failed or expired.',
        });
      } else if (statusRes?.isSimulated) {
        // Unconfigured gateway test fallback
        verifiedUtr = statusRes?.result?.utr || `SIM_UTR_${Date.now()}`;
      } else {
        return res.status(400).json({
          success: false,
          message: statusRes?.message || 'Order verification returned unexpected status.',
        });
      }
    }

    console.log('[CHIT_PAYMENT] Payment verified successfully:', {
      orderId: effectiveOrderId,
      utr: verifiedUtr,
    });

    // Payment Verified! Now complete the requested business operation automatically.
    const user = await User.findById(req.user._id);
    if (!user) {
      console.error('[CHIT_PAYMENT_ERROR] User not found:', req.user._id);
      return res.status(404).json({ message: 'User record not found' });
    }

    const paymentId = verifiedUtr;
    const signature = `VERIFIED_UPI_${effectiveOrderId}`;

    if (paymentType === 'investment') {
      const result = await completeInvestment(user, payloadData, effectiveOrderId, paymentId, signature, 'PayMe_UPI');
      await triggerReferralRewardOnInvestment(user._id, result?._id);
      console.log('[CHIT_PAYMENT] completed investment payout activation');
      return res.status(200).json({ success: true, message: 'Investment payment verified & approved automatically.', data: result, utr: verifiedUtr });
    } else if (paymentType === 'chit_join') {
      const result = await completeChitJoin(user, payloadData, effectiveOrderId, paymentId, signature, 'PayMe_UPI');
      await triggerReferralRewardOnInvestment(user._id, result?._id);
      console.log('[CHIT_PAYMENT] completed chit join membership activation');
      return res.status(200).json({ success: true, message: 'Chit join payment verified & membership activated.', data: result, utr: verifiedUtr });
    } else if (paymentType === 'chit_payment') {
      const result = await completeMonthlyDue(user, payloadData, effectiveOrderId, paymentId, signature, 'PayMe_UPI');
      await triggerReferralRewardOnInvestment(user._id, result?._id);
      console.log('[CHIT_PAYMENT] completed chit monthly/weekly due payment');
      return res.status(200).json({ success: true, message: 'Chit due payment verified & recorded successfully.', data: result, utr: verifiedUtr });
    } else if (paymentType === 'pocket_money') {
      const result = await completePocketMoney(user, payloadData, effectiveOrderId, paymentId, signature, 'PayMe_UPI');
      await triggerReferralRewardOnInvestment(user._id, result?._id);
      console.log('[CHIT_PAYMENT] completed pocket money activation');
      return res.status(200).json({ success: true, message: 'Pocket Money payment verified & activated.', data: result, utr: verifiedUtr });
    } else if (paymentType === 'sip_initial' || paymentType === 'sip_installment') {
      const sipController = require('./sipController');
      return await sipController.verifyPayment(
        {
          body: {
            order_id: effectiveOrderId,
            razorpay_order_id: effectiveOrderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
            utr: verifiedUtr,
            isSimulated,
            sipId: payloadData?.sipId,
            contributionId: payloadData?.contributionId,
            installmentNumber: payloadData?.installmentNumber,
          },
          user: req.user,
        },
        res
      );
    } else {
      console.warn('[CHIT_PAYMENT_ERROR] Unknown payment type:', paymentType);
      return res.status(400).json({ message: 'Unknown payment type' });
    }
  } catch (error) {
    console.error('[CHIT_PAYMENT_ERROR] Payment verification error:', error);
    res.status(500).json({ message: 'Payment verification failed', error: error.message });
  }
};

// ─── 3. Direct Check Order Status Endpoint ──────────────────────────────────
exports.checkOrderStatus = async (req, res) => {
  try {
    const order_id = req.body?.order_id || req.body?.orderId || req.query?.order_id;
    if (!order_id) {
      return res.status(400).json({ success: false, message: 'order_id is required' });
    }

    const statusData = await callGatewayCheckStatus(order_id);
    return res.status(200).json({
      success: true,
      data: statusData,
    });
  } catch (error) {
    console.error('[PaymentController] Check order status error:', error);
    res.status(500).json({ success: false, message: 'Failed to check order status', error: error.message });
  }
};

// ─── 4. Gateway Webhook Endpoint ────────────────────────────────────────────
exports.handleWebhook = async (req, res) => {
  try {
    const payload = req.body || {};
    console.log('[PaymentWebhook] Received incoming payment webhook:', payload);

    const orderId = payload.order_id || payload.orderId || payload.order_ID || req.query?.order_id;
    if (!orderId) {
      return res.status(200).json({ status: false, message: 'order_id parameter missing in webhook payload' });
    }

    // Query gateway to authenticate status
    const statusRes = await callGatewayCheckStatus(orderId);
    const status = (
      payload.status ||
      payload.txnStatus ||
      statusRes?.status ||
      statusRes?.result?.status ||
      statusRes?.result?.txnStatus ||
      ''
    ).toUpperCase();

    if (status === 'COMPLETED' || status === 'SUCCESS') {
      const utr = payload.utr || statusRes?.result?.utr || `UTR_${Date.now()}`;
      console.log(`[PaymentWebhook] Order ${orderId} confirmed successful via webhook with UTR: ${utr}`);
      return res.status(200).json({ status: true, message: 'Webhook processed successfully', orderId, utr });
    }

    return res.status(200).json({ status: true, message: `Webhook received with status: ${status}`, orderId });
  } catch (error) {
    console.error('[PaymentWebhook] Webhook error:', error);
    res.status(500).json({ status: false, message: 'Webhook error', error: error.message });
  }
};

// ─── Business Logic Helper Functions ─────────────────────────────────────────

// Complete Investment
const completeInvestment = async (user, data, orderId, paymentId, signature, provider = 'PayMe_UPI') => {
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
  
  // Authoritative tier and interest calculation
  const tierCalc = calculateInvestmentTier({
    planType: type,
    amount: Number(amount),
    startDate: new Date(),
    intendedWithdrawalDate: data.intendedWithdrawalDate || data.selectedWithdrawalDate,
    customDays: data.customDays || data.durationDays,
  });
  
  const startDate = tierCalc.startDate;
  const maturityDate = tierCalc.maturityDate;
  const intendedWithdrawalDate = tierCalc.intendedWithdrawalDate;

  // 5th week / Benefit eligibility date = 35 days (5 weeks) from startDate
  const benefitEligibilityDate = new Date(startDate.getTime() + 35 * 24 * 60 * 60 * 1000);
  benefitEligibilityDate.setHours(0, 0, 0, 0);

  // 1. Create & auto-approve investment
  const investment = new Investment({
    amount: tierCalc.principal,
    ref: refCode,
    status: 'approved', // Auto-approved upon verification
    type: tierCalc.planId,
    userId: user._id,
    userName: user.name || user.username,
    userEmail: user.email,
    mobileNumber: user.mobileNumber,
    interestRate: tierCalc.applicableInterestRate,
    planInterestRate: tierCalc.maxPlanRate,
    startDate,
    paymentProvider: provider || 'PayMe_UPI',
    paymentStatus: 'paid',
    orderId,
    paymentId,
    signature,
    paidAt: new Date(),
    verified: true,
    
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
    benefits: Number(data.benefits) || 0,
    fifthWeekPaymentCompleted: data.fifthWeekPaymentCompleted !== false,
    eligibilityStatus: 'tier_eligible',
    interestLogicVersion: 2,
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
    description: `${provider || 'UPI'} Deposit in ${type} plan (Txn ID: ${paymentId})`,
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

    // Trigger First-Time Investment Reward (50c) & Referral Investment Reward (50c + 100c)
    const { triggerFirstTimeAndReferralInvestmentReward } = require('../utils/referralHelper');
    await triggerFirstTimeAndReferralInvestmentReward(user._id, investment._id).catch(err =>
      console.warn('[ReferralTrigger Error]', err.message)
    );
  } catch (notifErr) {
    console.error('[PaymentController] Notification error:', notifErr);
  }

  return investment;
};

// Complete Chit Join
const completeChitJoin = async (user, data, orderId, paymentId, signature, provider = 'PayMe_UPI') => {
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

  // 1. Calculate Sunday-based Start and Due Date
  const isWeekly = chit.isWeekly !== false && chit.paymentFrequency !== 'monthly';
  const now = new Date();
  let startSunday = new Date(now);
  let nextDueDate;
  if (isWeekly) {
    const day = now.getDay();
    if (day === 0) {
      // Joined on Sunday: Week 1 is paid today, Week 2 is due next Sunday (+7 days)
      startSunday.setHours(0, 0, 0, 0);
      nextDueDate = new Date(startSunday.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else {
      // Joined Mon-Sat: Week 1 is paid upon joining, Week 2 is due on the very first upcoming Sunday
      nextDueDate = new Date(now.getTime() + (7 - day) * 24 * 60 * 60 * 1000);
    }
  } else {
    nextDueDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  nextDueDate.setHours(23, 59, 59, 999);

  // 2. Create a NEW individual ChitMember subscription
  const memberCount = await ChitMember.countDocuments({ chitId: chit._id, status: { $ne: 'cancelled' } });
  const memberNumber = memberCount + 1;
  let membershipId = '';
  let isUnique = false;
  while (!isUnique) {
    const randomPart = Math.floor(100000 + Math.random() * 900000);
    membershipId = `CM-${randomPart}`;
    const exists = await ChitMember.findOne({ membershipId });
    if (!exists) isUnique = true;
  }

  const member = new ChitMember({
    chitId: chit._id,
    userId: user._id,
    memberNumber,
    membershipId,
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
    joinedAt: startSunday,
    nextDueDate: nextDueDate,
  });
  await member.save();

  // Decrement available slots
  if (chit.availableSlots > 0) {
    chit.availableSlots -= 1;
    await chit.save();
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
    paymentProvider: provider || 'PayMe_UPI',
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
    description: `${provider || 'UPI'} Chit Join Payment - ${chit.name} (Week 1)`,
  });
  await transaction.save();

  // 4. Send Notification
  try {
    const { sendNotification, notifyAdmins } = require('../services/notificationHelper');
    const { triggerFirstChitJoinReward } = require('../utils/referralHelper');

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

    // Trigger First-Time Chit Join Reward (50c to user)
    await triggerFirstChitJoinReward(user._id, member._id).catch(err =>
      console.warn('[FirstChitReward Error]', err.message)
    );
  } catch (notifErr) {
    console.error('[PaymentController] Notification error:', notifErr);
  }

  return { member, payment };
};

// Complete Monthly Due
const completeMonthlyDue = async (user, data, orderId, paymentId, signature, provider = 'PayMe_UPI') => {
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
    paymentProvider: provider || 'PayMe_UPI',
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
    description: `${provider || 'UPI'} Chit Due Payment Week/Month ${resolvedMonth} (Txn ID: ${paymentId})`,
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
const completePocketMoney = async (user, data, orderId, paymentId, signature, provider = 'PayMe_UPI') => {
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
  const startDate = new Date();

  // Next payout date: first payout becomes eligible after one frequency cycle
  const nextPayoutDate = new Date(startDate);
  if (frequency === 'daily') {
    nextPayoutDate.setDate(nextPayoutDate.getDate() + 1);
  } else if (frequency === 'every_2_days') {
    nextPayoutDate.setDate(nextPayoutDate.getDate() + 2);
  } else if (frequency === 'weekly') {
    nextPayoutDate.setDate(nextPayoutDate.getDate() + 7);
  }

  // Final payout date = 10 payout cycles
  const finalPayoutDate = new Date(startDate);
  let eligibleDurationDays = 10;
  if (frequency === 'daily') {
    finalPayoutDate.setDate(finalPayoutDate.getDate() + 10);
    eligibleDurationDays = 10;
  } else if (frequency === 'every_2_days') {
    finalPayoutDate.setDate(finalPayoutDate.getDate() + 19);
    eligibleDurationDays = 19;
  } else if (frequency === 'weekly') {
    finalPayoutDate.setDate(finalPayoutDate.getDate() + 64);
    eligibleDurationDays = 64;
  }

  // 6% p.a. (Per Annum) Interest & Growvest Coin Reward Calculation
  // Annual Interest = Principal × 6%
  // Period Interest = Principal × 6% × (Eligible Duration in Days / 365)
  // Reward Coins = Math.round(Period Interest × 20) [20 Coins = ₹1]
  const annualInterestRate = 6;
  const eligibleInterestAmount = Number(((Number(amount) * 0.06 * eligibleDurationDays) / 365).toFixed(2));
  const rewardCoins = Math.round(eligibleInterestAmount * 20);
  const totalFinalValue = Number(amount); // Cash value is strictly principal (₹1,000)

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
    startDate,
    nextPayoutDate,
    finalPayoutDate,
    totalPaidOut: 0,      // Nothing paid out yet
    payoutCount: 0,       // No payout completed yet
    status: 'active',
    annualInterestRate,
    eligibleDurationDays,
    eligibleInterestAmount,
    rewardCoins,
    rewardStatus: 'locked',
    rewardReferenceId: `PM_REWARD_${orderId || paymentId || Date.now()}`,
    bonusRate: annualInterestRate,
    bonusAmount: eligibleInterestAmount,
    totalFinalValue,
    bonusReleased: false,
    paymentProvider: provider || 'PayMe_UPI',
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
    const { triggerFirstPocketMoneyReward } = require('../utils/referralHelper');

    await notifyAdmins({
      title: '🔔 New Pocket Money Investment',
      description: `${user.name || user.username} invested ₹${amount} in Pocket Money (${frequency}).`,
      type: 'general',
      metadata: { pocketMoneyId: pocketMoney._id },
    });

    // Trigger First-Time Pocket Money Reward (50c to user)
    await triggerFirstPocketMoneyReward(user._id, pocketMoney._id).catch(err =>
      console.warn('[FirstPocketReward Error]', err.message)
    );
  } catch (adminNotifErr) {
    console.error('[PaymentController] Admin notification error:', adminNotifErr);
  }
  
  return pocketMoney;
};
