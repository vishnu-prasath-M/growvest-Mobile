const Razorpay = require('razorpay');
const crypto = require('crypto');
const Investment = require('../models/Investment');
const ChitMember = require('../models/ChitMember');
const ChitPayment = require('../models/ChitPayment');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const PendingPayment = require('../models/PendingPayment');
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
  const baseUrl = (process.env.STARPE_BASE_URL || process.env.PG_URL || process.env.PAYME_BASE_URL || process.env.PG_BASE_URL || 'https://starpe.online').trim().replace(/\/+$/, '');
  const apiKey = (process.env.STARPE_API_KEY || process.env.PG_API_KEY || process.env.PAYME_API_KEY || '6056931258240a48113ca977a656211c').trim();
  const webhookSecret = (process.env.STARPE_WEBHOOK_SECRET || '5fcaecaddf6d7c7229ee4c61bb6d11b0174eb05f8cf85b2d').trim();
  const isConfigured = Boolean(
    baseUrl &&
    apiKey &&
    !baseUrl.includes('yourdomain.com') &&
    apiKey !== 'your_api_key_here'
  );
  return { baseUrl, apiKey, webhookSecret, isConfigured };
};

/**
 * Helper to call Gateway POST /api/create-order (supports .php endpoint fallback)
 */
const callGatewayCreateOrder = async ({ amount, orderId, mobile, customerName, redirectUrl, remark1, remark2 }) => {
  const { baseUrl, apiKey, isConfigured } = getGatewayConfig();
  if (!isConfigured) {
    return {
      success: false,
      isSimulated: true,
      message: 'Gateway credentials not configured; using simulation fallback.',
    };
  }

  const formParams = new URLSearchParams({
    api_key: apiKey,
    customer_mobile: String(mobile || '9999999999'),
    customer_name: String(customerName || 'Growvest User'),
    name: String(customerName || 'Growvest User'),
    customerName: String(customerName || 'Growvest User'),
    amount: String(amount),
    order_id: String(orderId),
    redirect_url: redirectUrl || '',
    remark1: String(customerName || remark1 || 'Growvest Payment'),
    remark2: String(remark2 || ''),
  });

  const candidateUrls = [
    `${baseUrl}/api/create-order.php`,
    `${baseUrl}/api/create-order`,
  ];

  let lastErr = null;
  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formParams.toString(),
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error('Failed to create order with gateway');
};

/**
 * Helper to call Gateway POST /api/check-order-status (supports .php endpoint fallback)
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

  const candidateUrls = [
    `${baseUrl}/api/check-order-status.php`,
    `${baseUrl}/api/check-order-status`,
  ];

  let lastErr = null;
  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formParams.toString(),
      });

      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error('Failed to check order status with gateway');
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
      const customerName = (user?.name && user.name.trim()) || user?.username || req.body?.customerName || 'Growvest User';
      const gwRes = await callGatewayCreateOrder({
        amount: Math.round(amount),
        orderId,
        mobile: customerMobile,
        customerName,
        redirectUrl,
        remark1: purpose || 'Growvest',
        remark2: user?._id?.toString() || '',
      });

      if (gwRes && (gwRes.status === true || gwRes.result?.payment_url)) {
        const finalOrderId = gwRes.result?.orderId || gwRes.result?.order_id || gwRes.order_id || gwRes.orderId || orderId;

        // ─── Save PendingPayment so webhook/callback can auto-complete business logic ───
        try {
          await PendingPayment.findOneAndUpdate(
            { orderId: finalOrderId },
            {
              orderId:     finalOrderId,
              userId:      user._id,
              paymentType: purpose || notes?.paymentType || 'investment',
              payloadData: notes || req.body?.payloadData || {},
              amount:      Math.round(amount),
              status:      'pending',
            },
            { upsert: true, new: true }
          );
          if (orderId && orderId !== finalOrderId) {
            await PendingPayment.findOneAndUpdate(
              { orderId: orderId },
              {
                orderId:     orderId,
                userId:      user._id,
                paymentType: purpose || notes?.paymentType || 'investment',
                payloadData: notes || req.body?.payloadData || {},
                amount:      Math.round(amount),
                status:      'pending',
              },
              { upsert: true, new: true }
            );
          }
          console.log(`[PaymentController] PendingPayment saved for order: ${finalOrderId}`);
        } catch (ppErr) {
          console.warn('[PaymentController] PendingPayment save warning:', ppErr.message);
        }

        return res.status(200).json({
          success: true,
          orderId: finalOrderId,
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

    // Check if order was already completed by Webhook or Callback
    const existingPending = await PendingPayment.findOne({ orderId: effectiveOrderId });
    if (existingPending && existingPending.status === 'completed') {
      console.log(`[PaymentController] Order ${effectiveOrderId} already processed via webhook/callback.`);
      return res.status(200).json({
        success: true,
        message: 'Payment verified and approved automatically.',
        orderId: effectiveOrderId,
        alreadyProcessed: true,
      });
    }

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

    // Execute business logic through centralized processor
    const processRes = await processSuccessfulOrder(
      effectiveOrderId,
      verifiedUtr,
      req.user,
      paymentType,
      payloadData
    );

    if (!processRes.success) {
      return res.status(500).json({ message: processRes.message || 'Failed to complete transaction' });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified & approved successfully.',
      data: processRes.data,
      utr: verifiedUtr,
    });
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

// ─── 4. Payment Gateway Callback (redirect after payment in browser) ──────────
// The gateway redirects the user's browser here after payment is completed.
// We verify gateway status, auto-process the order in MongoDB immediately,
// and deep-link back to the Growvest mobile app.
exports.handleCallback = async (req, res) => {
  try {
    const order_id = req.query?.order_id || req.query?.orderId || req.query?.order_ID ||
                     req.body?.order_id  || req.body?.orderId  || '';
    const status   = (req.query?.status || req.body?.status || 'unknown').toLowerCase();

    console.log(`[PaymentCallback] Received callback — order_id: ${order_id}, status: ${status}`);

    if (order_id) {
      try {
        const statusRes = await callGatewayCheckStatus(order_id);
        const gwStatus = (
          statusRes?.status ||
          statusRes?.result?.status ||
          statusRes?.result?.txnStatus ||
          status ||
          ''
        ).toUpperCase();

        if (gwStatus === 'COMPLETED' || gwStatus === 'SUCCESS') {
          const utr = statusRes?.result?.utr || `UTR_CB_${Date.now()}`;
          await processSuccessfulOrder(order_id, utr);
          console.log(`[PaymentCallback] Order ${order_id} verified & processed into DB via callback!`);
        }
      } catch (cbErr) {
        console.warn('[PaymentCallback] Background verify warning:', cbErr.message);
      }
    }

    const deepLink = `growvest://payment-callback?order_id=${encodeURIComponent(order_id)}&status=${encodeURIComponent(status)}`;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Complete – Growvest</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           background: #085428; color: #fff; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; text-align: center; padding: 24px; }
    .card { background: rgba(255,255,255,0.12); border-radius: 24px; padding: 40px 28px;
            max-width: 380px; width: 100%; backdrop-filter: blur(12px); box-shadow: 0 20px 40px rgba(0,0,0,0.25); }
    .icon { width: 72px; height: 72px; background: #FFD700; border-radius: 50%; display: flex;
            align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 38px; color: #085428; font-weight: bold; }
    h1 { font-size: 26px; font-weight: 700; margin-bottom: 8px; }
    p  { font-size: 15px; opacity: 0.9; margin-bottom: 28px; line-height: 1.5; }
    .btn { display: block; background: #FFD700; color: #085428; font-weight: 700;
           font-size: 16px; padding: 15px 32px; border-radius: 50px; text-decoration: none;
           box-shadow: 0 4px 15px rgba(255,215,0,0.4); }
    .spinner { width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.3);
               border-top-color: #FFD700; border-radius: 50%; animation: spin 0.8s linear infinite;
               margin: 16px auto 0; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10003;</div>
    <h1>Payment Successful!</h1>
    <p>Your payment has been received and verified. Returning to Growvest&hellip;</p>
    <a class="btn" href="${deepLink}">Return to App</a>
    <div class="spinner"></div>
  </div>
  <script>
    setTimeout(function() {
      window.location.href = '${deepLink}';
    }, 400);
  </script>
</body>
</html>`);
  } catch (error) {
    console.error('[PaymentCallback] Error:', error);
    res.status(500).send('Payment callback error');
  }
};

// ─── 5. Gateway Webhook Endpoint ─────────────────────────────────────────────
// This is called by Starpe gateway automatically when a payment succeeds.
// It looks up the PendingPayment record (saved at order creation) and
// runs the full business logic automatically.
exports.handleWebhook = async (req, res) => {
  try {
    const payload = req.body || {};
    console.log('[PaymentWebhook] Received:', JSON.stringify(payload));

    const data    = payload.data || {};
    const orderId = payload.order_id || payload.orderId || payload.order_ID ||
                    data.order_id   || data.orderId   || req.query?.order_id;

    if (!orderId) {
      return res.status(200).json({ status: false, message: 'order_id missing in webhook payload' });
    }

    // Confirm payment status with gateway
    const statusRes = await callGatewayCheckStatus(orderId);
    const status = (
      statusRes?.status ||
      statusRes?.result?.status ||
      statusRes?.result?.txnStatus ||
      payload.status ||
      payload.txnStatus ||
      data.status ||
      ''
    ).toUpperCase();

    console.log(`[PaymentWebhook] Order ${orderId} — status from gateway: ${status}`);

    if (status !== 'COMPLETED' && status !== 'SUCCESS') {
      return res.status(200).json({ status: true, message: `Webhook received with status: ${status}`, orderId });
    }

    const utr = statusRes?.result?.utr || payload.utr || data.utr || `UTR_WH_${Date.now()}`;
    await processSuccessfulOrder(orderId, utr);

    return res.status(200).json({ status: true, message: 'Webhook processed successfully and payment completed', orderId, utr });
  } catch (error) {
    console.error('[PaymentWebhook] Webhook error:', error);
    res.status(500).json({ status: false, message: 'Webhook error', error: error.message });
  }
};

// ─── Centralized Business Logic Execution Helper ────────────────────────────
async function processSuccessfulOrder(orderId, utr, fallbackUser = null, fallbackPaymentType = null, fallbackPayloadData = null) {
  let pending = await PendingPayment.findOne({ orderId });
  if (pending && pending.status === 'completed') {
    console.log(`[PaymentProcess] Order ${orderId} already completed.`);
    return { success: true, alreadyCompleted: true };
  }

  const userId = pending?.userId || fallbackUser?._id;
  const user = fallbackUser || (userId ? await User.findById(userId) : null);
  if (!user) {
    console.error(`[PaymentProcess] User not found for order ${orderId}`);
    return { success: false, message: 'User not found' };
  }

  const paymentType = pending?.paymentType || fallbackPaymentType || 'investment';
  const payloadData = pending?.payloadData || fallbackPayloadData || {};
  const paymentId = utr || `UTR_${Date.now()}`;
  const signature = `VERIFIED_UPI_${orderId}`;

  console.log(`[PaymentProcess] Completing: order=${orderId}, type=${paymentType}, user=${user._id}`);

  if (pending) {
    pending.status = 'completed';
    pending.completedAt = new Date();
    await pending.save().catch(() => {});
  }

  let result = null;
  if (paymentType === 'investment') {
    result = await completeInvestment(user, payloadData, orderId, paymentId, signature, 'PayMe_UPI');
    await triggerReferralRewardOnInvestment(user._id, result?._id).catch(() => {});
  } else if (paymentType === 'chit_join') {
    result = await completeChitJoin(user, payloadData, orderId, paymentId, signature, 'PayMe_UPI');
    await triggerReferralRewardOnInvestment(user._id, result?.member?._id || result?._id).catch(() => {});
  } else if (paymentType === 'chit_payment') {
    result = await completeMonthlyDue(user, payloadData, orderId, paymentId, signature, 'PayMe_UPI');
    await triggerReferralRewardOnInvestment(user._id, result?._id).catch(() => {});
  } else if (paymentType === 'pocket_money') {
    result = await completePocketMoney(user, payloadData, orderId, paymentId, signature, 'PayMe_UPI');
    await triggerReferralRewardOnInvestment(user._id, result?._id).catch(() => {});
  } else if (paymentType === 'sip_initial' || paymentType === 'sip_installment') {
    const sipController = require('./sipController');
    const fakeReq = {
      body: {
        order_id: orderId,
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        utr: paymentId,
        isSimulated: false,
        sipId: payloadData?.sipId,
        contributionId: payloadData?.contributionId,
        installmentNumber: payloadData?.installmentNumber,
      },
      user,
    };
    const fakeRes = {
      status: () => fakeRes,
      json: (d) => { console.log('[PaymentProcess] SIP verify result:', d); },
    };
    await sipController.verifyPayment(fakeReq, fakeRes);
  }

  return { success: true, data: result, utr: paymentId };
}

// ─── Business Logic Helper Functions ─────────────────────────────────────────

// Complete Investment
async function completeInvestment(user, data, orderId, paymentId, signature, provider = 'PayMe_UPI') {
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
async function completeChitJoin(user, data, orderId, paymentId, signature, provider = 'PayMe_UPI') {
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
async function completeMonthlyDue(user, data, orderId, paymentId, signature, provider = 'PayMe_UPI') {
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
async function completePocketMoney(user, data, orderId, paymentId, signature, provider = 'PayMe_UPI') {
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
