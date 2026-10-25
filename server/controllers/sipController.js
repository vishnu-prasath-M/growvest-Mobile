const mongoose = require('mongoose');
const SIP = require('../models/SIP');
const SIPContribution = require('../models/SIPContribution');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');
const { sendNotification, notifyAdmins } = require('../services/notificationHelper');
const crypto = require('crypto');
const cashfreeService = require('../services/cashfreeService');
const PendingPayment = require('../models/PendingPayment');

// ============================================================================
// === PREVIOUS STARPE PAYMENT GATEWAY (COMMENTED OUT AS REQUESTED) ===========
// ============================================================================
/*
const getGatewayConfig = () => {
  const baseUrl = (process.env.STARPE_BASE_URL || process.env.PG_URL || process.env.PAYME_BASE_URL || process.env.PG_BASE_URL || 'https://starpe.online').trim().replace(/\/+$/, '');
  const apiKey = (process.env.STARPE_API_KEY || process.env.PG_API_KEY || process.env.PAYME_API_KEY || '6056931258240a48113ca977a656211c').trim();
  const isConfigured = Boolean(
    baseUrl &&
    apiKey &&
    !baseUrl.includes('yourdomain.com') &&
    apiKey !== 'your_api_key_here'
  );
  return { baseUrl, apiKey, isConfigured };
};

const callGatewayCreateOrder = async ({ amount, orderId, mobile, redirectUrl, remark1, remark2 }) => {
  const { baseUrl, apiKey, isConfigured } = getGatewayConfig();
  if (!isConfigured) {
    return { success: false, isSimulated: true, message: 'Gateway not configured; test simulation fallback' };
  }
  const formParams = new URLSearchParams({
    api_key: apiKey,
    customer_mobile: String(mobile || '9999999999'),
    amount: String(amount),
    order_id: String(orderId),
    redirect_url: redirectUrl || '',
    remark1: remark1 || 'SIP Payment',
    remark2: remark2 || '',
  });

  const candidateUrls = [
    `${baseUrl}/api/create-order.php`,
    `${baseUrl}/api/create-order`,
  ];

  let lastErr = null;
  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formParams.toString(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Failed to create order with gateway');
};

const callGatewayCheckStatus = async (orderId) => {
  const { baseUrl, apiKey, isConfigured } = getGatewayConfig();
  if (!isConfigured) {
    return {
      status: 'SIMULATED',
      isSimulated: true,
      result: { txnStatus: 'COMPLETED', status: 'SUCCESS', orderId, utr: `SIM_UTR_${Date.now()}` },
    };
  }
  const formParams = new URLSearchParams({
    api_key: apiKey,
    order_id: String(orderId),
  });

  const candidateUrls = [
    `${baseUrl}/api/check-order-status.php`,
    `${baseUrl}/api/check-order-status`,
  ];

  let lastErr = null;
  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formParams.toString(),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Failed to check order status with gateway');
};
*/

// Helper to calculate recurring due date by frequency safely
const calculateDueDate = (startDate, installmentIndex, frequency = 'monthly', sipDate = 10, sipDayName = 'Monday') => {
  const target = new Date(startDate);

  if (frequency === 'daily') {
    target.setDate(target.getDate() + installmentIndex);
    target.setHours(23, 59, 59, 999);
    return target;
  }

  if (frequency === 'weekly') {
    target.setDate(target.getDate() + installmentIndex * 7);
    target.setHours(23, 59, 59, 999);
    return target;
  }

  // Monthly
  target.setMonth(target.getMonth() + installmentIndex);
  const maxDays = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(sipDate, maxDays));
  target.setHours(23, 59, 59, 999);
  return target;
};

// Generate Unique SIP ID: SIP-YYYYMMDD-XXXX
const generateSIPId = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SIP-${dateStr}-${rand}`;
};

// ─── 1. Create SIP & Order for First Contribution ───────────────────────────
exports.createSIP = async (req, res) => {
  try {
    const {
      amount,
      sipDate,
      sipDayName = 'Monday',
      durationMonths,
      durationCount,
      frequency = 'monthly',
      notes,
    } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount < 10) {
      return res.status(400).json({ message: 'Minimum SIP contribution amount is ₹10' });
    }

    let totalInstallments = 12;
    let numSipDate = 1;
    let monthsEquivalent = 12;
    const startDate = new Date();
    let endDate = new Date(startDate);

    if (frequency === 'daily') {
      const days = Number(durationCount) || 30;
      if (days < 7) {
        return res.status(400).json({ message: 'Minimum daily SIP duration is 7 days' });
      }
      totalInstallments = days;
      monthsEquivalent = Math.max(1, Math.round(days / 30));
      endDate = new Date(startDate.getTime() + (days - 1) * 24 * 60 * 60 * 1000);
    } else if (frequency === 'weekly') {
      const weeks = Number(durationCount) || 12;
      if (weeks < 4) {
        return res.status(400).json({ message: 'Minimum weekly SIP duration is 4 weeks' });
      }
      totalInstallments = weeks;
      monthsEquivalent = Math.max(1, Math.round(weeks / 4));
      endDate = new Date(startDate.getTime() + (weeks - 1) * 7 * 24 * 60 * 60 * 1000);
    } else {
      // Monthly
      const validDates = [1, 5, 10, 15, 20, 25];
      numSipDate = Number(sipDate) || 10;
      if (!validDates.includes(numSipDate)) {
        return res.status(400).json({ message: 'Please select a valid monthly SIP date (1st, 5th, 10th, 15th, 20th, or 25th)' });
      }
      const months = Number(durationMonths || durationCount) || 12;
      if (months < 1) {
        return res.status(400).json({ message: 'Please select a valid duration' });
      }
      totalInstallments = months;
      monthsEquivalent = months;
      endDate.setMonth(endDate.getMonth() + months);
    }

    const totalPlannedAmount = numAmount * totalInstallments;
    const sipIdStr = generateSIPId();

    // 26% p.a. Dynamic SIP Returns Calculation
    const interestRate = 26; // 26% p.a.
    const periodicRate = frequency === 'daily'
      ? (0.26 / 365)
      : frequency === 'weekly'
      ? ((0.26 * 7) / 365)
      : (0.26 / 12);
    const expectedInterest = Math.round(numAmount * periodicRate * ((totalInstallments * (totalInstallments + 1)) / 2));
    const expectedMaturityAmount = totalPlannedAmount + expectedInterest;

    // 1. Create Parent SIP record in pending_payment status until first contribution succeeds
    const sip = new SIP({
      sipId: sipIdStr,
      userId: user._id,
      userEmail: user.email,
      userName: user.name || user.username,
      mobileNumber: user.mobileNumber,
      amount: numAmount,
      frequency,
      sipDate: numSipDate,
      sipDayName,
      durationMonths: monthsEquivalent,
      durationCount: totalInstallments,
      startDate,
      endDate,
      totalPlannedAmount,
      totalPaidAmount: 0,
      totalContributions: totalInstallments,
      contributionsCompleted: 0,
      remainingContributions: totalInstallments,
      nextContributionDate: calculateDueDate(startDate, 1, frequency, numSipDate, sipDayName),
      interestRate,
      expectedInterest,
      expectedMaturityAmount,
      status: 'pending_payment',
      notes,
    });
    await sip.save();

    // 2. Pre-create scheduled SIPContribution slots
    const contributions = [];
    for (let i = 1; i <= totalInstallments; i++) {
      const dueDate = i === 1 ? new Date() : calculateDueDate(startDate, i - 1, frequency, numSipDate, sipDayName);
      const contribution = new SIPContribution({
        contributionId: `SIPC-${sipIdStr.replace('SIP-', '')}-${String(i).padStart(2, '0')}`,
        sipId: sip._id,
        sipRefId: sipIdStr,
        userId: user._id,
        installmentNumber: i,
        amount: numAmount,
        dueDate,
        paymentStatus: 'pending',
      });
      contributions.push(contribution);
    }
    await SIPContribution.insertMany(contributions);

    // 3. Create Order for Contribution #1 with Cashfree
    const orderId = `ORD_SIP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const returnUrl = `${process.env.APP_URL || 'https://growvest-mobile.onrender.com'}/api/payment/callback?order_id=${orderId}`;
    let paymentUrl = `simulated_pay_${orderId}`;
    let paymentSessionId = null;
    let isSimulated = false;

    try {
      const customerMobile = user.mobileNumber || '9999999999';
      const customerName = user.name || user.username || 'Growvest User';
      const customerEmail = user.email || `${customerMobile}@growvest.com`;

      const cfRes = await cashfreeService.createOrder({
        orderId,
        amount: Math.round(numAmount),
        customerPhone: customerMobile,
        customerName,
        customerEmail,
        returnUrl,
      });

      if (cfRes && cfRes.success && (cfRes.paymentUrl || cfRes.paymentSessionId)) {
        paymentUrl = cfRes.paymentUrl;
        paymentSessionId = cfRes.paymentSessionId;

        // Save PendingPayment so Cashfree callback/webhook can auto-complete SIP activation
        try {
          await PendingPayment.findOneAndUpdate(
            { orderId },
            {
              orderId,
              userId: user._id,
              paymentType: 'sip_initial',
              payloadData: {
                sipId: sip._id,
                contributionId: contributions[0]._id,
                installmentNumber: 1,
              },
              amount: Math.round(numAmount),
              status: 'pending',
            },
            { upsert: true, new: true }
          );
          console.log(`[SIPController] PendingPayment saved for Cashfree SIP order: ${orderId}`);
        } catch (ppErr) {
          console.warn('[SIPController] PendingPayment save warning:', ppErr.message);
        }
      } else {
        isSimulated = true;
      }
    } catch (cfErr) {
      console.warn('[SIPController] Cashfree order fallback:', cfErr.message);
      isSimulated = true;
    }

    res.status(201).json({
      success: true,
      message: 'SIP plan created. Proceed to complete first contribution.',
      data: {
        sip,
        firstContribution: contributions[0],
        orderId,
        paymentSessionId,
        paymentUrl,
        amount: Math.round(numAmount),
        currency: 'INR',
        gateway: 'cashfree',
        isSimulated,
      },
    });
  } catch (error) {
    console.error('[SIPController] Create SIP error:', error);
    res.status(500).json({ message: 'Failed to create SIP plan', error: error.message });
  }
};

// ─── 2. Verify Payment (Initial or Installment) ──────────────────────────────
exports.verifyPayment = async (req, res) => {
  try {
    const {
      order_id,
      orderId,
      utr,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      sipId,
      contributionId,
      installmentNumber,
      isSimulated: clientIsSimulated,
    } = req.body;
    const userId = req.user._id;

    const effectiveOrderId = order_id || orderId || razorpay_order_id;
    if (!effectiveOrderId) {
      return res.status(400).json({ message: 'Missing order ID for payment verification' });
    }

    // Check if order was already completed by Webhook or Callback
    const existingPending = await PendingPayment.findOne({ orderId: effectiveOrderId });
    if (existingPending && existingPending.status === 'completed') {
      console.log(`[SIPController] Order ${effectiveOrderId} already processed via webhook/callback.`);
    }

    // === CASHFREE VERIFICATION ===
    let verifiedUtr = utr || razorpay_payment_id || `UTR_${Date.now()}`;
    const isSimulated =
      clientIsSimulated ||
      effectiveOrderId.startsWith('order_sim_') ||
      effectiveOrderId.startsWith('ORD_SIM_') ||
      (razorpay_signature && razorpay_signature.startsWith('simulated_'));

    if (!isSimulated) {
      const statusRes = await cashfreeService.checkOrderStatus(effectiveOrderId);
      console.log('[SIPController] Cashfree status check result:', statusRes);

      const status = (statusRes?.orderStatus || '').toUpperCase();

      if (status === 'PAID') {
        verifiedUtr =
          statusRes.paymentDetails?.bankReference ||
          statusRes.paymentDetails?.cfPaymentId ||
          verifiedUtr;
      } else if (status === 'ACTIVE') {
        return res.status(200).json({
          success: false,
          isPending: true,
          message: 'Payment is still processing with Cashfree. If you just paid, please wait a few seconds and tap verify again.',
        });
      } else if (status === 'EXPIRED' || status === 'TERMINATED') {
        return res.status(400).json({
          success: false,
          isFailed: true,
          message: `Payment ${status.toLowerCase()}. Please initiate a new payment.`,
        });
      } else if (statusRes?.isSimulated) {
        verifiedUtr = `SIM_UTR_${Date.now()}`;
      } else {
        return res.status(400).json({
          success: false,
          message: statusRes?.message || `Cashfree returned order status: ${status}`,
        });
      }
    }

    // Find SIP & Contribution
    const sip = await SIP.findOne({ _id: sipId, userId });
    if (!sip) {
      return res.status(404).json({ message: 'SIP plan not found' });
    }

    let contribution = null;
    if (contributionId) {
      contribution = await SIPContribution.findOne({ _id: contributionId, sipId: sip._id, userId });
    }
    if (!contribution && installmentNumber) {
      contribution = await SIPContribution.findOne({ sipId: sip._id, installmentNumber, userId });
    }
    if (!contribution) {
      // Find the earliest pending contribution
      contribution = await SIPContribution.findOne({ sipId: sip._id, paymentStatus: 'pending', userId }).sort({ installmentNumber: 1 });
    }

    if (!contribution) {
      return res.status(404).json({ message: 'Target SIP contribution not found' });
    }

    // Idempotency: If already paid, return
    if (contribution.paymentStatus === 'paid') {
      return res.status(200).json({ success: true, message: 'Contribution already verified', data: { sip, contribution } });
    }

    // Mark Contribution as Paid
    const receiptId = `RCP-SIP-${Date.now().toString().slice(-8)}`;
    contribution.paymentStatus = 'paid';
    contribution.paidAt = new Date();
    contribution.orderId = effectiveOrderId;
    contribution.paymentId = verifiedUtr;
    contribution.signature = `VERIFIED_CASHFREE_${effectiveOrderId}`;
    contribution.receiptId = receiptId;
    contribution.withdrawableAmount = contribution.amount;
    await contribution.save();

    // Mark PendingPayment as completed if exists
    try {
      await PendingPayment.findOneAndUpdate(
        { orderId: effectiveOrderId },
        { status: 'completed', completedAt: new Date() }
      );
    } catch (e) {}

    // Update parent SIP totals
    sip.totalPaidAmount = (sip.totalPaidAmount || 0) + contribution.amount;
    sip.contributionsCompleted = (sip.contributionsCompleted || 0) + 1;
    sip.remainingContributions = Math.max(0, sip.totalContributions - sip.contributionsCompleted);
    if (sip.status === 'pending_payment') {
      sip.status = 'active';
    }

    // Compute next due date
    const nextPending = await SIPContribution.findOne({ sipId: sip._id, paymentStatus: 'pending' }).sort({ installmentNumber: 1 });
    if (nextPending) {
      sip.nextContributionDate = nextPending.dueDate;
    } else {
      sip.nextContributionDate = null;
      if (sip.contributionsCompleted >= sip.totalContributions) {
        sip.status = 'completed';
      }
    }
    await sip.save();

    // Create Transaction history entry
    const user = await User.findById(userId);
    const transaction = new Transaction({
      userId: user._id,
      userEmail: user.email,
      type: 'investment',
      amount: contribution.amount,
      status: 'approved',
      referenceId: contribution._id,
      referenceType: 'SIP',
      description: `UPI SIP Contribution #${contribution.installmentNumber} - ${sip.sipId} (Txn: ${verifiedUtr})`,
    });
    await transaction.save();

    // Send notifications
    try {
      await sendNotification({
        userId: user._id,
        title: 'SIP Contribution Successful',
        description: `Your SIP contribution #${contribution.installmentNumber} of ₹${contribution.amount.toLocaleString('en-IN')} for ${sip.sipId} was successfully added.`,
        type: 'investment_approved',
        pushData: { screen: 'SIPDetails', sipId: sip._id.toString() },
      });

      await notifyAdmins({
        title: '📈 New SIP Contribution Received',
        description: `${user.name || user.username} contributed ₹${contribution.amount} for ${sip.sipId} (Installment #${contribution.installmentNumber}).`,
        type: 'general',
        metadata: { sipId: sip._id, contributionId: contribution._id },
      });

      if (sip.status === 'completed') {
        await sendNotification({
          userId: user._id,
          title: '🎉 SIP Plan Completed!',
          description: `Congratulations! Your SIP plan ${sip.sipId} has reached full completion (${sip.totalContributions} contributions).`,
          type: 'general',
        });
      }
    } catch (notifErr) {
      console.warn('[SIPController] Notification error:', notifErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'SIP contribution payment verified successfully',
      data: { sip, contribution },
    });
  } catch (error) {
    console.error('[SIPController] Verify payment error:', error);
    res.status(500).json({ message: 'Payment verification failed', error: error.message });
  }
};

// ─── 3. Cancel / Discard Unpaid Pending SIP (When User Cancels Payment) ──────
exports.cancelPendingSIP = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const sip = await SIP.findOne({ _id: id, userId });
    if (!sip) {
      return res.status(404).json({ success: false, message: 'SIP plan not found' });
    }

    // Only allow purging if no money was ever paid
    if ((sip.totalPaidAmount || 0) === 0 && (sip.contributionsCompleted || 0) === 0) {
      await SIPContribution.deleteMany({ sipId: sip._id });
      await SIP.findByIdAndDelete(sip._id);
      return res.status(200).json({ success: true, message: 'Unpaid draft SIP discarded successfully' });
    }

    return res.status(400).json({ success: false, message: 'Cannot discard an active SIP with paid contributions' });
  } catch (error) {
    console.error('[SIPController] Cancel pending SIP error:', error);
    res.status(500).json({ message: 'Failed to cancel pending SIP', error: error.message });
  }
};

// Helper to calculate real-time accrued interest at 26% p.a. based on contribution periods
const calculateSIPInterest = (sip, contributions = []) => {
  const annualRate = (Number(sip.interestRate) || 26) / 100;
  const frequency = sip.frequency || 'monthly';
  const periodicRate = frequency === 'daily'
    ? (annualRate / 365)
    : frequency === 'weekly'
    ? ((annualRate * 7) / 365)
    : (annualRate / 12);

  const paidContributions = contributions
    .filter((c) => c.paymentStatus === 'paid')
    .sort((a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0));

  const k = paidContributions.length;
  let accruedInterest = 0;

  for (let idx = 0; idx < k; idx++) {
    const c = paidContributions[idx];
    const amount = Number(c.amount) || 0;
    // Contribution at idx has accrued interest for (k - idx) completed contribution periods
    const periodsActive = Math.max(1, k - idx);
    const itemInterest = amount * periodicRate * periodsActive;
    accruedInterest += itemInterest;
  }

  const isFullMaturity =
    (sip.status === 'completed' && (sip.contributionsCompleted >= sip.totalContributions)) ||
    (sip.totalContributions > 0 && k >= sip.totalContributions);

  const interestEarned = isFullMaturity
    ? Math.max(Number(accruedInterest.toFixed(2)), Number(sip.expectedInterest) || 0)
    : Number(accruedInterest.toFixed(2));

  const totalPaid = Number(sip.totalPaidAmount) || (k * (Number(sip.amount) || 0));
  const withdrawn = Number(sip.withdrawnAmount) || 0;

  // If cancelled/closed before maturity, do not grant maturity interest
  const withdrawableInterest = (sip.status === 'cancelled' && k < sip.totalContributions)
    ? 0
    : interestEarned;
  const availableToWithdraw = Math.max(0, Number((totalPaid + withdrawableInterest - withdrawn).toFixed(2)));
  const currentValue = Math.max(0, Number((totalPaid + interestEarned - withdrawn).toFixed(2)));

  return {
    interestEarned,
    accruedInterest: Number(accruedInterest.toFixed(2)),
    availableToWithdraw,
    currentValue,
  };
};

// ─── 4. Get All SIPs for Authenticated User ─────────────────────────────────
exports.getMySIPs = async (req, res) => {
  try {
    const userId = req.user._id;

    // Clean up any abandoned draft SIPs with 0 contributions / payments
    const abandonedSIPs = await SIP.find({
      userId,
      contributionsCompleted: 0,
      totalPaidAmount: 0,
      status: { $in: ['pending_payment', 'active'] },
    }).select('_id');

    if (abandonedSIPs.length > 0) {
      const abandonedIds = abandonedSIPs.map((s) => s._id);
      await SIPContribution.deleteMany({ sipId: { $in: abandonedIds } });
      await SIP.deleteMany({ _id: { $in: abandonedIds } });
    }

    const sips = await SIP.find({
      userId,
      status: { $ne: 'pending_payment' },
      contributionsCompleted: { $gt: 0 },
    }).sort({ createdAt: -1 }).lean();

    const sipIds = sips.map((s) => s._id);
    const paidContributions = await SIPContribution.find({
      sipId: { $in: sipIds },
      paymentStatus: 'paid',
    }).lean();

    const contribsBySip = {};
    for (const c of paidContributions) {
      const sId = c.sipId.toString();
      if (!contribsBySip[sId]) contribsBySip[sId] = [];
      contribsBySip[sId].push(c);
    }

    let totalInterestEarned = 0;
    const enrichedSips = sips.map((s) => {
      const sId = s._id.toString();
      const myPaid = contribsBySip[sId] || [];
      const stats = calculateSIPInterest(s, myPaid);

      if (s.status !== 'cancelled' || s.contributionsCompleted >= s.totalContributions) {
        totalInterestEarned += stats.interestEarned;
      }

      return {
        ...s,
        ...stats,
      };
    });

    const totalSIPInvested = sips.reduce((sum, s) => sum + (s.totalPaidAmount || 0), 0);
    const activeSIPCount = sips.filter((s) => s.status === 'active').length;
    const totalContributionsPaid = sips.reduce((sum, s) => sum + (s.contributionsCompleted || 0), 0);
    totalInterestEarned = Number(totalInterestEarned.toFixed(2));
    const totalCurrentValue = Number((totalSIPInvested + totalInterestEarned).toFixed(2));

    // Find nearest upcoming due date among active SIPs
    const activeNextDates = sips
      .filter((s) => s.status === 'active' && s.nextContributionDate)
      .map((s) => new Date(s.nextContributionDate).getTime());
    const nextUpcomingDate = activeNextDates.length > 0 ? new Date(Math.min(...activeNextDates)) : null;

    res.status(200).json({
      success: true,
      summary: {
        totalSIPInvested,
        totalInterestEarned,
        totalCurrentValue,
        activeSIPCount,
        totalContributionsPaid,
        nextUpcomingDate,
      },
      sips: enrichedSips,
    });
  } catch (error) {
    console.error('[SIPController] Get my SIPs error:', error);
    res.status(500).json({ message: 'Failed to fetch SIPs', error: error.message });
  }
};

// ─── 4. Get Specific SIP Details & Contribution History ─────────────────────
exports.getSIPById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const sip = await SIP.findOne({
      $and: [
        { $or: [{ _id: mongoose.Types.ObjectId.isValid(id) ? id : null }, { sipId: id }] },
        { userId },
      ],
    }).lean();

    if (!sip) {
      return res.status(404).json({ message: 'SIP plan not found' });
    }

    // If SIP is cancelled, ensure any pending contribution is synced to cancelled
    if (sip.status === 'cancelled') {
      await SIPContribution.updateMany(
        { sipId: sip._id, paymentStatus: 'pending' },
        { $set: { paymentStatus: 'cancelled' } }
      );
    }

    const contributions = await SIPContribution.find({ sipId: sip._id, userId })
      .sort({ installmentNumber: 1 })
      .lean();

    // Check pending withdrawal
    const pendingWithdrawal = await Withdrawal.findOne({
      investmentId: sip._id,
      status: 'pending',
    }).lean();

    const pendingWithdrawalAmount = pendingWithdrawal ? Number(pendingWithdrawal.amount || 0) : 0;
    const hasPendingWithdrawal = Boolean(pendingWithdrawal);

    const stats = calculateSIPInterest(sip, contributions);

    // Calculate withdrawable principal for this SIP only
    const availablePrincipal = Math.max(0, (sip.totalPaidAmount || 0) - (sip.withdrawnAmount || 0) - pendingWithdrawalAmount);
    const isFullyWithdrawn = (sip.totalPaidAmount || 0) > 0 && availablePrincipal <= 0 && (sip.withdrawnAmount || 0) >= (sip.totalPaidAmount || 0);

    res.status(200).json({
      success: true,
      data: {
        ...sip,
        ...stats,
        availablePrincipal,
        pendingWithdrawalAmount,
        hasPendingWithdrawal,
        isFullyWithdrawn,
        contributions,
      },
    });
  } catch (error) {
    console.error('[SIPController] Get SIP details error:', error);
    res.status(500).json({ message: 'Failed to fetch SIP details', error: error.message });
  }
};

// ─── 5. Pay Installment (Order generation for scheduled due) ────────────────
exports.payInstallment = async (req, res) => {
  try {
    const { id, contributionId } = req.body;
    const userId = req.user._id;

    const sip = await SIP.findOne({ _id: id, userId });
    if (!sip) {
      return res.status(404).json({ message: 'SIP plan not found' });
    }

    if (sip.status === 'cancelled') {
      return res.status(400).json({ message: 'This SIP has been cancelled.' });
    }

    const contribution = await SIPContribution.findOne({ _id: contributionId, sipId: sip._id, userId });
    if (!contribution) {
      return res.status(404).json({ message: 'Contribution installment not found' });
    }

    if (contribution.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'This installment has already been paid.' });
    }

    const orderId = `ORD_SIP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const returnUrl = `${process.env.APP_URL || 'https://growvest-mobile.onrender.com'}/api/payment/callback?order_id=${orderId}`;
    let paymentUrl = `simulated_pay_${orderId}`;
    let paymentSessionId = null;
    let isSimulated = false;

    try {
      const customerMobile = req.user?.mobileNumber || '9999999999';
      const customerName = req.user?.name || req.user?.username || 'Growvest User';
      const customerEmail = req.user?.email || `${customerMobile}@growvest.com`;

      const cfRes = await cashfreeService.createOrder({
        orderId,
        amount: Math.round(contribution.amount),
        customerPhone: customerMobile,
        customerName,
        customerEmail,
        returnUrl,
      });

      if (cfRes && cfRes.success && (cfRes.paymentUrl || cfRes.paymentSessionId)) {
        paymentUrl = cfRes.paymentUrl;
        paymentSessionId = cfRes.paymentSessionId;

        // Save PendingPayment so Cashfree callback/webhook can auto-complete installment payment
        try {
          await PendingPayment.findOneAndUpdate(
            { orderId },
            {
              orderId,
              userId,
              paymentType: 'sip_installment',
              payloadData: {
                sipId: sip._id,
                contributionId: contribution._id,
                installmentNumber: contribution.installmentNumber,
              },
              amount: Math.round(contribution.amount),
              status: 'pending',
            },
            { upsert: true, new: true }
          );
          console.log(`[SIPController] PendingPayment saved for Cashfree installment order: ${orderId}`);
        } catch (ppErr) {
          console.warn('[SIPController] PendingPayment save warning:', ppErr.message);
        }
      } else {
        isSimulated = true;
      }
    } catch (cfErr) {
      console.warn('[SIPController] Installment Cashfree fallback:', cfErr.message);
      isSimulated = true;
    }

    res.status(200).json({
      success: true,
      orderId,
      paymentSessionId,
      paymentUrl,
      amount: Math.round(contribution.amount),
      currency: 'INR',
      gateway: 'cashfree',
      isSimulated,
      contribution,
    });
  } catch (error) {
    console.error('[SIPController] Pay installment error:', error);
    res.status(500).json({ message: 'Failed to create payment order', error: error.message });
  }
};

// ─── 6. Withdraw From Specific SIP ──────────────────────────────────────────
exports.withdrawSIP = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, upiId } = req.body;
    const userId = req.user._id;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Valid withdrawal amount is required' });
    }

    if (!upiId || typeof upiId !== 'string' || !/^[a-zA-Z0-9.\-_]{2,100}@[a-zA-Z0-9.\-_]{2,64}$/.test(upiId.trim())) {
      return res.status(400).json({ message: 'Valid UPI ID format is required (e.g. username@okhdfcbank or 9876543210@paytm)' });
    }

    const sip = await SIP.findOne({ _id: id, userId });
    if (!sip) {
      return res.status(404).json({ message: 'SIP plan not found' });
    }

    const user = await User.findById(userId);
    const availablePrincipal = Math.max(0, (sip.totalPaidAmount || 0) - (sip.withdrawnAmount || 0));

    if (Number(amount) > availablePrincipal) {
      return res.status(400).json({
        message: `Requested amount exceeds available balance for ${sip.sipId}. Available: ₹${availablePrincipal.toLocaleString('en-IN')}`,
      });
    }

    // 1. Create Withdrawal request
    const withdrawal = new Withdrawal({
      userId: user._id,
      investmentId: sip._id,
      amount: Number(amount),
      upiId: upiId.trim(),
      userName: user.name || user.username,
      userEmail: user.email,
      date: new Date().toLocaleDateString(),
      status: 'pending',
      withdrawType: 'sip',
    });
    await withdrawal.save();

    // 2. Create Transaction history record
    const transaction = new Transaction({
      userId: user._id,
      userEmail: user.email,
      type: 'withdrawal',
      amount: Number(amount),
      status: 'requested',
      referenceId: withdrawal._id,
      referenceType: 'Withdrawal',
      description: `SIP Withdrawal Request from ${sip.sipId} - ₹${amount}`,
    });
    await transaction.save();

    // 3. Update SIP withdrawn amount
    sip.withdrawnAmount = (sip.withdrawnAmount || 0) + Number(amount);
    await sip.save();

    // 4. Send notifications
    try {
      await sendNotification({
        userId: user._id,
        title: 'SIP Withdrawal Requested',
        description: `Your withdrawal request of ₹${Number(amount).toLocaleString('en-IN')} from ${sip.sipId} has been submitted.`,
        type: 'general',
      });

      await notifyAdmins({
        title: '💸 New SIP Withdrawal Request',
        description: `${user.name || user.username} requested to withdraw ₹${amount} from ${sip.sipId}.`,
        type: 'general',
        metadata: { withdrawalId: withdrawal._id, sipId: sip._id },
      });
    } catch (notifErr) {
      console.warn('[SIPController] Notification error:', notifErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'SIP withdrawal request submitted successfully',
      data: { withdrawal, updatedSIP: sip },
    });
  } catch (error) {
    console.error('[SIPController] Withdraw SIP error:', error);
    res.status(500).json({ message: 'Failed to process SIP withdrawal', error: error.message });
  }
};

// ─── 7. Cancel SIP Plan ─────────────────────────────────────────────────────
exports.cancelSIP = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const sip = await SIP.findOne({ _id: id, userId });
    if (!sip) {
      return res.status(404).json({ message: 'SIP plan not found' });
    }

    if (sip.status === 'cancelled') {
      return res.status(400).json({ message: 'This SIP is already cancelled.' });
    }

    if (sip.status === 'completed') {
      return res.status(400).json({ message: 'Completed SIP plans cannot be cancelled.' });
    }

    // 1. Mark future pending contributions as cancelled (preserve paid history)
    await SIPContribution.updateMany(
      { sipId: sip._id, paymentStatus: 'pending' },
      { $set: { paymentStatus: 'cancelled' } }
    );

    // 2. Set SIP status to cancelled
    sip.status = 'cancelled';
    sip.nextContributionDate = null;
    await sip.save();

    // 3. Send Notification
    try {
      await sendNotification({
        userId,
        title: 'SIP Cancelled',
        description: `Your SIP plan ${sip.sipId} has been cancelled. Your past contributions of ₹${sip.totalPaidAmount.toLocaleString('en-IN')} remain safe in your portfolio.`,
        type: 'general',
      });
    } catch (e) {}

    res.status(200).json({
      success: true,
      message: 'SIP cancelled successfully. Future scheduled contributions stopped.',
      data: sip,
    });
  } catch (error) {
    console.error('[SIPController] Cancel SIP error:', error);
    res.status(500).json({ message: 'Failed to cancel SIP', error: error.message });
  }
};

// ─── 7B. Request Withdrawal from Specific SIP ────────────────────────────────
exports.withdrawSIP = async (req, res) => {
  try {
    const sipId = req.params.id;
    const { amount, upiId } = req.body;
    const userId = req.user._id;

    const sip = await SIP.findOne({ _id: sipId, userId });
    if (!sip) {
      return res.status(404).json({ message: 'SIP not found' });
    }

    const withdrawAmt = Number(amount);
    if (!withdrawAmt || withdrawAmt <= 0) {
      return res.status(400).json({ message: 'Invalid withdrawal amount' });
    }

    const contribs = await SIPContribution.find({ sipId: sip._id }).lean();
    const stats = calculateSIPInterest(sip, contribs);
    const availableToWithdraw = stats.availableToWithdraw;

    if (withdrawAmt > availableToWithdraw) {
      return res.status(400).json({
        message: `Requested amount ₹${withdrawAmt} exceeds available SIP balance of ₹${availableToWithdraw}`
      });
    }

    const resolvedUPI = upiId || req.user.upiId || 'user@upi';
    const withdrawalRecord = new Withdrawal({
      userId,
      userEmail: req.user.email || req.user.username || 'user@growvest.in',
      userName: req.user.name || req.user.username || 'User',
      amount: withdrawAmt,
      upiId: resolvedUPI,
      date: new Date().toLocaleDateString('en-IN'),
      status: 'pending',
      withdrawType: 'sip',
      investmentId: sip._id,
      processed: false,
    });
    await withdrawalRecord.save();

    sip.withdrawnAmount = (sip.withdrawnAmount || 0) + withdrawAmt;
    if (sip.withdrawnAmount >= (sip.totalPaidAmount || 0)) {
      if (sip.contributionsCompleted >= sip.totalContributions) {
        sip.status = 'completed';
      } else {
        sip.status = 'cancelled';
      }
    }
    await sip.save();

    const transaction = new Transaction({
      userId,
      userEmail: req.user.email || 'user@growvest.in',
      type: 'withdrawal',
      amount: withdrawAmt,
      status: 'requested',
      referenceId: withdrawalRecord._id,
      referenceType: 'Withdrawal',
      description: `SIP Withdrawal Request - ${sip.sipId}`,
    });
    await transaction.save();

    try {
      await sendNotification({
        userId,
        title: '⏳ SIP Withdrawal Requested',
        description: `Your SIP withdrawal request for ₹${withdrawAmt.toLocaleString('en-IN')} has been submitted for admin verification.`,
        type: 'general',
      });
      await notifyAdmins({
        title: '💸 SIP Withdrawal Request',
        description: `${req.user.name || req.user.email} requested to withdraw ₹${withdrawAmt.toLocaleString('en-IN')} from SIP ${sip.sipId}.`,
        type: 'general',
      });
    } catch (e) {}

    res.status(200).json({
      success: true,
      message: `SIP withdrawal request for ₹${withdrawAmt.toLocaleString('en-IN')} submitted successfully.`,
      withdrawal: withdrawalRecord,
    });
  } catch (error) {
    console.error('[SIPController] Withdraw error:', error);
    res.status(500).json({ message: 'Failed to process SIP withdrawal', error: error.message });
  }
};

// ─── 8. Admin Overview & Management ─────────────────────────────────────────
exports.getAdminSIPs = async (req, res) => {
  try {
    const sips = await SIP.find().sort({ createdAt: -1 }).lean();
    const contributions = await SIPContribution.find().sort({ createdAt: -1 }).limit(100).lean();

    const totalSIPs = sips.length;
    const activeSIPs = sips.filter((s) => s.status === 'active').length;
    const completedSIPs = sips.filter((s) => s.status === 'completed').length;
    const cancelledSIPs = sips.filter((s) => s.status === 'cancelled').length;
    const totalSIPAmount = sips.reduce((sum, s) => sum + (s.totalPaidAmount || 0), 0);

    const pendingPayments = await SIPContribution.countDocuments({ paymentStatus: 'pending' });
    const failedPayments = await SIPContribution.countDocuments({ paymentStatus: 'failed' });

    res.status(200).json({
      success: true,
      stats: {
        totalSIPs,
        activeSIPs,
        completedSIPs,
        cancelledSIPs,
        totalSIPAmount,
        pendingPayments,
        failedPayments,
      },
      sips,
      recentContributions: contributions,
    });
  } catch (error) {
    console.error('[SIPController] Admin SIP error:', error);
    res.status(500).json({ message: 'Failed to fetch admin SIPs', error: error.message });
  }
};
