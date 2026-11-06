const crypto = require('crypto');
const Investment = require('../models/Investment');
const ChitMember = require('../models/ChitMember');
const ChitPayment = require('../models/ChitPayment');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const PendingPayment = require('../models/PendingPayment');
const ManualPayment = require('../models/ManualPayment');
const Settings = require('../models/Settings');
const fs = require('fs');
const path = require('path');
const { triggerReferralRewardOnInvestment } = require('../utils/referralHelper');
const { sendNotification } = require('../services/notificationHelper');
const PocketMoney = require('../models/PocketMoney');
const PocketMoneyPayout = require('../models/PocketMoneyPayout');
const { calculateInvestmentTier } = require('../services/investmentTierService');
const cashfreeService = require('../services/cashfreeService');
const autoUpiService = require('../services/autoUpiService');

// Register AutoUPI payment completed callback
autoUpiService.registerPaymentPaidCallback(async (payment) => {
  try {
    console.log('[AutoUPI Callback] Auto-completing order:', payment.orderId, 'UTR:', payment.utr);
    await processSuccessfulOrder(
      payment.orderId,
      payment.utr,
      null,
      payment.metadata?.paymentType,
      payment.metadata?.payloadData
    );
  } catch (err) {
    console.error('[AutoUPI Callback] Error processing paid order:', err);
  }
});

async function getCompanyUpiConfig() {
  try {
    const upiIdSetting = await Settings.findOne({ key: 'company_upi_id' });
    const payeeNameSetting = await Settings.findOne({ key: 'company_payee_name' });
    const qrImageSetting = await Settings.findOne({ key: 'company_qr_image' });
    const gmailUserSetting = await Settings.findOne({ key: 'canara_gmail_user' });
    const gmailPassSetting = await Settings.findOne({ key: 'canara_gmail_password' });
    const autoApproveSetting = await Settings.findOne({ key: 'canara_auto_approval_enabled' });

    return {
      upiId: (upiIdSetting?.value || '8925699005@upi').trim(),
      payeeName: (payeeNameSetting?.value || 'Growvest Investments').trim(),
      qrImage: (qrImageSetting?.value || '').trim(),
      gmailUser: (gmailUserSetting?.value || '').trim(),
      hasGmailPassword: Boolean(gmailPassSetting?.value && !gmailPassSetting.value.includes('abcd')),
      autoApprovalEnabled: autoApproveSetting ? autoApproveSetting.value === 'true' : true,
    };
  } catch (err) {
    return {
      upiId: '8925699005@upi',
      payeeName: 'Growvest Investments',
      qrImage: '',
      gmailUser: '',
      hasGmailPassword: false,
      autoApprovalEnabled: true,
    };
  }
}


// ============================================================================
// === PREVIOUS STARPE PAYMENT GATEWAY (COMMENTED OUT AS REQUESTED) ===========
// ============================================================================
/*
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
*/

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

    // ============================================================================
    // === MANUAL UPI ORDER CREATION (CASHFREE COMMENTED OUT AS REQUESTED) ========
    // ============================================================================
    /*
    // === CASHFREE ORDER CREATION ===
    const user = req.user;
    const orderId = `ORD_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const returnUrl = `${process.env.APP_URL || 'https://growvest-mobile.onrender.com'}/api/payment/callback?order_id=${orderId}`;
    const customerMobile = user?.mobileNumber || req.body?.mobileNumber || '9999999999';
    const customerName = (user?.name && user.name.trim()) || user?.username || req.body?.customerName || 'Growvest User';
    const customerEmail = user?.email || `${customerMobile}@growvest.com`;

    try {
      const cfRes = await cashfreeService.createOrder({
        orderId,
        amount: Math.round(amount),
        customerPhone: customerMobile,
        customerName,
        customerEmail,
        returnUrl,
      });

      if (cfRes && cfRes.success && (cfRes.paymentUrl || cfRes.paymentSessionId)) {
        const finalOrderId = cfRes.orderId || orderId;

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
          console.log(`[PaymentController] PendingPayment saved for Cashfree order: ${finalOrderId}`);
        } catch (ppErr) {
          console.warn('[PaymentController] PendingPayment save warning:', ppErr.message);
        }

        return res.status(200).json({
          success: true,
          orderId: finalOrderId,
          paymentSessionId: cfRes.paymentSessionId,
          paymentUrl: cfRes.paymentUrl,
          amount: Math.round(amount),
          currency: 'INR',
          gateway: 'cashfree',
          isSimulated: false,
        });
      }

      console.warn('[PaymentController] Cashfree returned non-success response:', cfRes);
      return res.status(200).json({
        success: true,
        orderId,
        paymentUrl: `simulated_pay_${orderId}`,
        amount: Math.round(amount),
        currency: 'INR',
        gateway: 'cashfree',
        isSimulated: true,
        message: cfRes?.message || 'Cashfree running in test simulation mode',
      });
    } catch (cfErr) {
      console.warn('[PaymentController] Cashfree API call error, using test fallback:', cfErr.message);
      return res.status(200).json({
        success: true,
        orderId,
        paymentUrl: `simulated_pay_${orderId}`,
        amount: Math.round(amount),
        currency: 'INR',
        gateway: 'cashfree',
        isSimulated: true,
        message: 'Cashfree offline or unreachable. Test simulation fallback enabled.',
      });
    }
  } catch (error) {
    */

    const user = req.user;
    const orderId = `UPI_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const effectivePaymentType = purpose || notes?.paymentType || 'investment';
    const payload = notes || req.body?.payloadData || {};
    const baseAmount = Math.round(Number(amount));

    let upiPayment = null;
    let payAmount = baseAmount;
    let upiLink = null;
    let qrSvg = null;
    let ref = `GV${Date.now().toString().slice(-8)}`;

    try {
      const autoUpi = await autoUpiService.initAutoUpi();
      upiPayment = await autoUpi.createPayment({
        amount: baseAmount,
        orderId,
        customer: user?.mobileNumber || user?.email || 'Growvest User',
        note: `Growvest ${orderId}`,
        metadata: {
          userId: user._id,
          paymentType: effectivePaymentType,
          payloadData: payload,
        },
      });

      if (upiPayment) {
        payAmount = upiPayment.payAmount;
        ref = upiPayment.ref;
        upiLink = upiPayment.link;
        qrSvg = upiPayment.qr;
      }
    } catch (upiErr) {
      console.warn('[PaymentController] autoUpi createPayment warning, using fallback paise:', upiErr.message);
      // Fallback: Add 1-99 paise if autoUpi failed
      const randomPaise = Math.floor(Math.random() * 90 + 10) / 100;
      payAmount = Math.round((baseAmount + randomPaise) * 100) / 100;
    }

    try {
      await PendingPayment.findOneAndUpdate(
        { orderId },
        {
          orderId,
          userId: user._id,
          paymentType: effectivePaymentType,
          payloadData: payload,
          amount: baseAmount,
          payAmount,
          ref,
          status: 'pending',
        },
        { upsert: true, new: true }
      );
    } catch (ppErr) {
      console.warn('[PaymentController] PendingPayment save warning:', ppErr.message);
    }

    const upiConfig = await getCompanyUpiConfig();

    return res.status(200).json({
      success: true,
      orderId,
      amount: baseAmount,
      payAmount,
      currency: 'INR',
      gateway: 'canara_auto_upi',
      ref,
      upiLink,
      qrSvg,
      paymentType: effectivePaymentType,
      companyUpi: upiConfig,
    });
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

    // === CASHFREE VERIFICATION ===
    let verifiedUtr = utr || razorpay_payment_id || `UTR_${Date.now()}`;
    const isSimulated =
      clientIsSimulated ||
      effectiveOrderId.startsWith('order_sim_') ||
      effectiveOrderId.startsWith('ORD_SIM_') ||
      (razorpay_signature && razorpay_signature.startsWith('simulated_'));

    if (!isSimulated) {
      const statusRes = await cashfreeService.checkOrderStatus(effectiveOrderId);
      console.log('[PaymentController] Cashfree status check result:', statusRes);

      const status = (statusRes?.orderStatus || statusRes?.status || '').toUpperCase();
      const isPaid = statusRes?.isPaid || status === 'PAID' || status === 'SUCCESS';
      const isPending = statusRes?.isPending || status === 'ACTIVE' || status === 'PENDING';

      if (isPaid) {
        verifiedUtr =
          statusRes.paymentDetails?.bankReference ||
          statusRes.paymentDetails?.cfPaymentId ||
          statusRes.utr ||
          verifiedUtr;
      } else if (isPending) {
        return res.status(200).json({
          success: false,
          isPending: true,
          message: 'Payment is still processing with Cashfree. If you just completed the payment, please wait a few seconds and tap verify again.',
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

    const statusData = await cashfreeService.checkOrderStatus(order_id);
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
// Cashfree redirects the user's browser here after payment is completed.
// We verify Cashfree status, auto-process the order in MongoDB immediately,
// and deep-link back to the Growvest mobile app.
exports.handleCallback = async (req, res) => {
  try {
    const order_id = req.query?.order_id || req.query?.orderId || req.query?.order_ID ||
                     req.body?.order_id  || req.body?.orderId  || '';
    let finalStatus = 'pending';

    console.log(`[PaymentCallback] Received Cashfree callback — order_id: ${order_id}`);

    if (order_id) {
      try {
        const statusRes = await cashfreeService.checkOrderStatus(order_id);
        const status = (statusRes?.orderStatus || statusRes?.status || '').toUpperCase();
        const isPaid = statusRes?.isPaid || status === 'PAID' || status === 'SUCCESS';
        const isPending = statusRes?.isPending || status === 'ACTIVE' || status === 'PENDING';

        if (isPaid) {
          finalStatus = 'success';
          const utr =
            statusRes.paymentDetails?.bankReference ||
            statusRes.paymentDetails?.cfPaymentId ||
            statusRes.utr ||
            `UTR_CF_${Date.now()}`;
          await processSuccessfulOrder(order_id, utr);
          console.log(`[PaymentCallback] Order ${order_id} verified & processed into DB via Cashfree callback!`);
        } else if (isPending) {
          finalStatus = 'pending';
        } else {
          finalStatus = 'failed';
        }
      } catch (cbErr) {
        console.warn('[PaymentCallback] Background verify warning:', cbErr.message);
      }
    }

    const deepLink = `growvest://payment-callback?order_id=${encodeURIComponent(order_id)}&status=${encodeURIComponent(finalStatus)}`;

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

// ─── 4b. Cashfree Hosted Web Checkout Page ──────────────────────────────────
// Serves the Cashfree official JS SDK v3 checkout interface using payment_session_id.
// Cashfree automatically mounts UPI, Cards, NetBanking, Wallets and handles return_url.
exports.renderCashfreeCheckout = async (req, res) => {
  try {
    const session_id = req.query?.session_id || req.query?.sessionId || '';
    const order_id = req.query?.order_id || req.query?.orderId || '';

    if (!session_id) {
      return res.status(400).send('Missing session_id for Cashfree checkout');
    }

    const { env } = cashfreeService.getCashfreeConfig();
    const mode = (env === 'PRODUCTION') ? 'production' : 'sandbox';

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Cashfree Secure Checkout – Growvest</title>
  <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #085428;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
      padding: 24px;
    }
    .card {
      background: rgba(255,255,255,0.12);
      border-radius: 24px;
      padding: 36px 24px;
      max-width: 380px;
      width: 100%;
      backdrop-filter: blur(12px);
      box-shadow: 0 20px 40px rgba(0,0,0,0.25);
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 4px solid rgba(255,255,255,0.2);
      border-top-color: #FFD700;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 16px auto 20px;
    }
    h2 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    p { font-size: 14px; opacity: 0.85; line-height: 1.4; margin-bottom: 20px; }
    .btn {
      display: inline-block;
      background: #FFD700;
      color: #085428;
      font-weight: 700;
      padding: 12px 28px;
      border-radius: 50px;
      border: none;
      font-size: 15px;
      cursor: pointer;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h2>Opening Cashfree Payment...</h2>
    <p>Connecting to secure payment gateway. Please wait a moment&hellip;</p>
    <button id="retryBtn" class="btn" style="display:none;" onclick="triggerCheckout()">Click to Pay</button>
  </div>
  <script>
    function triggerCheckout() {
      try {
        const cashfree = Cashfree({ mode: "${mode}" });
        cashfree.checkout({
          paymentSessionId: "${session_id}",
          redirectTarget: "_self"
        }).then(function(res) {
          if (res && res.error) {
            console.error("Cashfree checkout error:", res.error);
            document.getElementById("retryBtn").style.display = "inline-block";
          }
        });
      } catch (err) {
        console.error("Cashfree initialization error:", err);
        document.getElementById("retryBtn").style.display = "inline-block";
      }
    }

    window.addEventListener("DOMContentLoaded", function() {
      setTimeout(triggerCheckout, 200);
    });
  </script>
</body>
</html>`);
  } catch (error) {
    console.error('[RenderCashfreeCheckout] Error:', error);
    res.status(500).send('Failed to initialize Cashfree checkout');
  }
};

// ─── 5. Gateway Webhook Endpoint ─────────────────────────────────────────────
// Called by Cashfree asynchronously when payment succeeds or changes status.
// Verifies HMAC-SHA256 signature using req.rawBody and timestamp.
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    const rawBody = req.rawBody;

    // Verify signature with Cashfree secret
    const isSigValid = cashfreeService.verifyWebhookSignature(signature, timestamp, rawBody);
    if (!isSigValid) {
      console.warn('[PaymentWebhook] Invalid Cashfree webhook signature');
      return res.status(400).json({ status: false, message: 'Invalid webhook signature' });
    }

    const payload = req.body || {};
    console.log('[PaymentWebhook] Received Cashfree webhook:', JSON.stringify(payload));

    const data = payload.data || {};
    const orderData = data.order || {};
    const paymentData = data.payment || {};

    const orderId =
      orderData.order_id ||
      data.order_id ||
      payload.order_id ||
      payload.orderId ||
      req.query?.order_id;

    if (!orderId) {
      return res.status(200).json({ status: false, message: 'order_id missing in webhook payload' });
    }

    const orderStatus = (orderData.order_status || payload.order_status || '').toUpperCase();
    const paymentStatus = (paymentData.payment_status || '').toUpperCase();
    const eventType = (payload.type || '').toUpperCase();

    if (orderStatus === 'PAID' || paymentStatus === 'SUCCESS' || eventType === 'PAYMENT_SUCCESS_WEBHOOK') {
      const utr = paymentData.bank_reference || paymentData.cf_payment_id || `UTR_WH_${Date.now()}`;
      await processSuccessfulOrder(orderId, utr);
      console.log(`[PaymentWebhook] Cashfree order ${orderId} completed successfully!`);
      return res.status(200).json({ status: true, message: 'Webhook processed successfully', orderId, utr });
    }

    // Secondary fallback: verify live status with Cashfree
    const statusRes = await cashfreeService.checkOrderStatus(orderId);
    const isLivePaid = statusRes?.isPaid || statusRes?.status === 'SUCCESS' || (statusRes?.orderStatus || '').toUpperCase() === 'PAID';
    if (isLivePaid) {
      const utr =
        statusRes.paymentDetails?.bankReference ||
        statusRes.paymentDetails?.cfPaymentId ||
        statusRes.utr ||
        `UTR_WH_${Date.now()}`;
      await processSuccessfulOrder(orderId, utr);
      return res.status(200).json({ status: true, message: 'Verified and processed successfully', orderId, utr });
    }

    return res.status(200).json({
      status: true,
      message: `Webhook received with order_status: ${orderStatus || statusRes.orderStatus}`,
      orderId,
    });
  } catch (error) {
    console.error('[PaymentWebhook] Webhook error:', error);
    res.status(500).json({ status: false, message: 'Webhook error', error: error.message });
  }
};

// ─── Centralized Business Logic Execution Helper ────────────────────────────
async function processSuccessfulOrder(orderId, utr, fallbackUser = null, fallbackPaymentType = null, fallbackPayloadData = null) {
  let pending = null;
  if (orderId && orderId !== 'simulated') {
    pending = await PendingPayment.findOneAndUpdate(
      { orderId, status: { $ne: 'completed' } },
      { $set: { status: 'completed', completedAt: new Date() } },
      { new: false }
    );
    // If pending payment exists and was ALREADY completed by another concurrent webhook/call, stop duplicate processing
    if (!pending) {
      const alreadyDone = await PendingPayment.findOne({ orderId, status: 'completed' });
      if (alreadyDone) {
        console.log(`[PaymentProcess] Order ${orderId} already completed (atomic lock).`);
        return { success: true, alreadyCompleted: true };
      }
    }
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
  const signature = `VERIFIED_CASHFREE_${orderId}`;

  console.log(`[PaymentProcess] Completing: order=${orderId}, type=${paymentType}, user=${user._id}`);

  let result = null;
  if (paymentType === 'investment') {
    result = await completeInvestment(user, payloadData, orderId, paymentId, signature, 'Cashfree');
    await triggerReferralRewardOnInvestment(user._id, result?._id).catch(() => {});
  } else if (paymentType === 'chit_join') {
    result = await completeChitJoin(user, payloadData, orderId, paymentId, signature, 'Cashfree');
    await triggerReferralRewardOnInvestment(user._id, result?.member?._id || result?._id).catch(() => {});
  } else if (paymentType === 'chit_payment') {
    result = await completeMonthlyDue(user, payloadData, orderId, paymentId, signature, 'Cashfree');
    await triggerReferralRewardOnInvestment(user._id, result?._id).catch(() => {});
  } else if (paymentType === 'pocket_money') {
    result = await completePocketMoney(user, payloadData, orderId, paymentId, signature, 'Cashfree');
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

  // Idempotency check: if payment already processed for this paymentId or orderId, return existing
  if (paymentId || (orderId && orderId !== 'simulated')) {
    const existingPayment = await ChitPayment.findOne({
      $or: [
        ...(paymentId ? [{ paymentId }] : []),
        ...(orderId && orderId !== 'simulated' ? [{ orderId }] : [])
      ]
    });
    if (existingPayment) {
      console.log(`[PaymentController] Chit due payment ${paymentId} / ${orderId} already processed (idempotency check).`);
      return existingPayment;
    }
  }

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


// ============================================================================
// ─── MANUAL UPI PAYMENT CONTROLLER METHODS ──────────────────────────────────
// ============================================================================

// 1. User submits UTR and optional screenshot for payment verification
exports.submitManualPayment = async (req, res) => {
  try {
    const { orderId, utr, screenshotBase64, userRemarks, paymentType, amount, payloadData } = req.body;

    if (!orderId || !utr || !utr.trim()) {
      return res.status(400).json({ success: false, message: 'Order ID and 12-digit UPI Reference (UTR) are required.' });
    }

    const cleanUtr = utr.trim();

    // Prevent duplicate UTR abuse on already-approved transactions
    const duplicateApproved = await ManualPayment.findOne({ utr: cleanUtr, status: 'approved' });
    if (duplicateApproved) {
      return res.status(400).json({
        success: false,
        message: 'This UPI Reference (UTR) has already been approved for another transaction. If you believe this is an error, please contact support.',
      });
    }

    let screenshotUrl = '';
    if (screenshotBase64) {
      try {
        const uploadDir = path.join(__dirname, '../public/uploads/payments');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const cleanBase64 = screenshotBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        const filename = `proof-${Date.now()}-${Math.round(Math.random() * 1e4)}.png`;
        fs.writeFileSync(path.join(uploadDir, filename), buffer);
        screenshotUrl = `/uploads/payments/${filename}`;
      } catch (uploadErr) {
        console.warn('[ManualPayment] Screenshot save error:', uploadErr.message);
      }
    }

    // Retrieve pending payment context if exists
    const pending = await PendingPayment.findOne({ orderId });

    const finalPaymentType = pending?.paymentType || paymentType || 'investment';
    const finalAmount = pending?.amount || Number(amount) || 0;
    const finalPayload = pending?.payloadData || payloadData || {};

    const manualRecord = await ManualPayment.findOneAndUpdate(
      { orderId },
      {
        orderId,
        userId: req.user._id,
        paymentType: finalPaymentType,
        amount: finalAmount,
        payloadData: finalPayload,
        utr: cleanUtr,
        ...(screenshotUrl ? { screenshotUrl } : {}),
        userRemarks: (userRemarks || '').trim(),
        status: 'pending',
        submittedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // Update PendingPayment status to track user submission
    if (pending) {
      pending.status = 'pending';
      await pending.save();
    }

    // Send in-app notification confirming submission
    try {
      await sendNotification({
        userId: req.user._id,
        title: 'Payment Submitted ⏳',
        description: `Your payment of ₹${finalAmount.toLocaleString('en-IN')} (Ref: ${cleanUtr}) has been submitted. Our team will verify and activate your ${finalPaymentType.replace('_', ' ')} within 15–30 minutes.`,
        type: 'general',
      });
    } catch (_) {}

    res.status(200).json({
      success: true,
      message: 'Payment verification submitted successfully! Admin will verify and activate shortly.',
      manualPayment: manualRecord,
    });
  } catch (error) {
    console.error('[ManualPayment] Submit error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit payment verification', error: error.message });
  }
};

// 2. Admin: Get all pending manual payments
exports.getPendingManualPayments = async (req, res) => {
  try {
    const list = await ManualPayment.find({ status: 'pending' })
      .populate('userId', 'name username email mobileNumber')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: list.length, data: list });
  } catch (error) {
    console.error('[ManualPayment] Get pending error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending payments', error: error.message });
  }
};

// 3. Admin: Get all manual payments history
exports.getAllManualPayments = async (req, res) => {
  try {
    const list = await ManualPayment.find()
      .populate('userId', 'name username email mobileNumber')
      .sort({ createdAt: -1 })
      .limit(200);

    res.status(200).json({ success: true, count: list.length, data: list });
  } catch (error) {
    console.error('[ManualPayment] Get all error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch manual payments history', error: error.message });
  }
};

// 4. Admin: Approve a manual payment request
exports.approveManualPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const manualPayment = await ManualPayment.findById(id).populate('userId');

    if (!manualPayment) {
      return res.status(404).json({ success: false, message: 'Manual payment request not found' });
    }

    if (manualPayment.status === 'approved') {
      return res.status(400).json({ success: false, message: 'This payment has already been approved.' });
    }

    // Call centralized business logic processor to activate investment / chit / SIP / pocket money
    const processRes = await processSuccessfulOrder(
      manualPayment.orderId,
      manualPayment.utr,
      manualPayment.userId,
      manualPayment.paymentType,
      manualPayment.payloadData
    );

    if (!processRes.success) {
      return res.status(500).json({
        success: false,
        message: processRes.message || 'Error processing transaction completion',
      });
    }

    manualPayment.status = 'approved';
    manualPayment.reviewedBy = req.user._id;
    manualPayment.reviewedAt = new Date();
    await manualPayment.save();

    // Update PendingPayment status if exists
    await PendingPayment.findOneAndUpdate(
      { orderId: manualPayment.orderId },
      { status: 'completed', completedAt: new Date() }
    );

    // Send push notification & in-app alert to user
    try {
      await sendNotification({
        userId: manualPayment.userId._id || manualPayment.userId,
        title: 'Payment Approved! 🎉',
        description: `Your payment of ₹${manualPayment.amount.toLocaleString('en-IN')} (UTR: ${manualPayment.utr}) has been verified. Your ${manualPayment.paymentType.replace('_', ' ')} is now active!`,
        type: 'general',
      });
    } catch (_) {}

    res.status(200).json({
      success: true,
      message: 'Payment approved successfully and account updated!',
      data: processRes.data,
      manualPayment,
    });
  } catch (error) {
    console.error('[ManualPayment] Approve error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve payment', error: error.message });
  }
};

// 5. Admin: Reject a manual payment request
exports.rejectManualPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const manualPayment = await ManualPayment.findById(id);

    if (!manualPayment) {
      return res.status(404).json({ success: false, message: 'Manual payment request not found' });
    }

    if (manualPayment.status === 'approved') {
      return res.status(400).json({ success: false, message: 'Cannot reject an already approved payment.' });
    }

    manualPayment.status = 'rejected';
    manualPayment.adminRemarks = (reason || 'UTR could not be verified in company bank account').trim();
    manualPayment.reviewedBy = req.user._id;
    manualPayment.reviewedAt = new Date();
    await manualPayment.save();

    await PendingPayment.findOneAndUpdate(
      { orderId: manualPayment.orderId },
      { status: 'failed' }
    );

    // Notify user of rejection with reason
    try {
      await sendNotification({
        userId: manualPayment.userId,
        title: 'Payment Verification Rejected ⚠️',
        description: `Your payment of ₹${manualPayment.amount.toLocaleString('en-IN')} was rejected: ${manualPayment.adminRemarks}. Please check your UTR or contact support.`,
        type: 'general',
      });
    } catch (_) {}

    res.status(200).json({
      success: true,
      message: 'Payment request rejected.',
      manualPayment,
    });
  } catch (error) {
    console.error('[ManualPayment] Reject error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject payment', error: error.message });
  }
};

// 6. Public/User: Get active Company UPI configuration
exports.getCompanyUpiDetails = async (req, res) => {
  try {
    const upiConfig = await getCompanyUpiConfig();
    res.status(200).json({ success: true, config: upiConfig });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get UPI details', error: error.message });
  }
};

// 7. Admin: Update Company UPI configuration
exports.updateCompanyUpiDetails = async (req, res) => {
  try {
    const { upiId, payeeName, qrImageBase64 } = req.body;

    if (upiId) {
      await Settings.findOneAndUpdate(
        { key: 'company_upi_id' },
        { value: upiId.trim(), updatedAt: new Date(), updatedBy: req.user._id },
        { upsert: true }
      );
    }

    if (payeeName) {
      await Settings.findOneAndUpdate(
        { key: 'company_payee_name' },
        { value: payeeName.trim(), updatedAt: new Date(), updatedBy: req.user._id },
        { upsert: true }
      );
    }

    if (qrImageBase64) {
      const uploadDir = path.join(__dirname, '../public/uploads/payments');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const cleanBase64 = qrImageBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const filename = `company-qr-${Date.now()}.png`;
      fs.writeFileSync(path.join(uploadDir, filename), buffer);
      const qrUrl = `/uploads/payments/${filename}`;

      await Settings.findOneAndUpdate(
        { key: 'company_qr_image' },
        { value: qrUrl, updatedAt: new Date(), updatedBy: req.user._id },
        { upsert: true }
      );
    }

    if (req.body.gmailUser !== undefined) {
      await Settings.findOneAndUpdate(
        { key: 'canara_gmail_user' },
        { value: String(req.body.gmailUser || '').trim(), updatedAt: new Date(), updatedBy: req.user._id },
        { upsert: true }
      );
    }

    if (req.body.gmailPassword !== undefined && String(req.body.gmailPassword).trim().length > 0) {
      await Settings.findOneAndUpdate(
        { key: 'canara_gmail_password' },
        { value: String(req.body.gmailPassword).trim(), updatedAt: new Date(), updatedBy: req.user._id },
        { upsert: true }
      );
    }

    if (req.body.autoApprovalEnabled !== undefined) {
      await Settings.findOneAndUpdate(
        { key: 'canara_auto_approval_enabled' },
        { value: String(Boolean(req.body.autoApprovalEnabled)), updatedAt: new Date(), updatedBy: req.user._id },
        { upsert: true }
      );
    }

    // Reload active autoUpi instance
    await autoUpiService.reloadConfig();

    const updatedConfig = await getCompanyUpiConfig();
    res.status(200).json({ success: true, message: 'Company UPI settings updated successfully!', config: updatedConfig });
  } catch (error) {
    console.error('[ManualPayment] Update UPI config error:', error);
    res.status(500).json({ success: false, message: 'Failed to update UPI settings', error: error.message });
  }
};

// 8. Direct live status check for mobile app auto-polling
exports.checkUpiOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    // Check PendingPayment
    const pending = await PendingPayment.findOne({ orderId });
    if (pending && pending.status === 'completed') {
      return res.status(200).json({
        success: true,
        status: 'completed',
        orderId,
        amount: pending.amount,
        payAmount: pending.payAmount,
        message: 'Payment completed & verified!',
      });
    }

    // Check UpiPayment from MongoStore
    const UpiPayment = require('../models/UpiPayment');
    const payment = await UpiPayment.findOne({ orderId });
    if (payment && payment.status === 'paid') {
      await processSuccessfulOrder(orderId, payment.utr);
      return res.status(200).json({
        success: true,
        status: 'completed',
        orderId,
        utr: payment.utr,
        amount: payment.amount,
        payAmount: payment.payAmount,
        message: 'Payment verified via Canara Bank alert!',
      });
    }

    // Check ManualPayment
    const manual = await ManualPayment.findOne({ orderId });
    if (manual && manual.status === 'approved') {
      return res.status(200).json({
        success: true,
        status: 'completed',
        orderId,
        utr: manual.utr,
        message: 'Payment approved by Admin!',
      });
    }

    return res.status(200).json({
      success: true,
      status: 'pending',
      orderId,
      payAmount: payment?.payAmount || pending?.payAmount || pending?.amount,
      message: 'Awaiting Canara Bank transaction credit confirmation...',
    });
  } catch (err) {
    console.error('[checkUpiOrderStatus] error:', err);
    res.status(500).json({ success: false, message: 'Error checking order status', error: err.message });
  }
};

// 9. Instant UTR claim from mobile app (against bank alerts)
exports.claimUpiUtr = async (req, res) => {
  try {
    const { orderId, utr } = req.body;
    if (!orderId || !utr) {
      return res.status(400).json({ success: false, message: 'orderId and 12-digit utr are required' });
    }

    const cleanUtr = String(utr).trim();
    if (!/^\d{12}$/.test(cleanUtr)) {
      return res.status(400).json({ success: false, message: 'UTR must be exactly 12 digits' });
    }

    const UpiPayment = require('../models/UpiPayment');
    const payment = await UpiPayment.findOne({ orderId });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found for this order' });
    }

    if (payment.status === 'paid') {
      return res.status(200).json({ success: true, status: 'paid', message: 'Payment already verified!' });
    }

    const store = autoUpiService.getStore();
    if (store) {
      const claimResult = await store.claimUtr(payment.id, cleanUtr);
      if (claimResult && (claimResult.result === 'paid' || claimResult.settled)) {
        await processSuccessfulOrder(orderId, cleanUtr);
        return res.status(200).json({
          success: true,
          status: 'paid',
          message: 'Payment verified instantly against Canara Bank credit alert!',
          utr: cleanUtr,
        });
      }
    }

    // If alert has not landed in Gmail yet, save to ManualPayment so Admin can also see it
    const pending = await PendingPayment.findOne({ orderId });
    await ManualPayment.findOneAndUpdate(
      { orderId },
      {
        orderId,
        userId: req.user._id,
        paymentType: pending?.paymentType || 'investment',
        amount: pending?.amount || payment.amount,
        payloadData: pending?.payloadData || {},
        utr: cleanUtr,
        userRemarks: 'Submitted via 12-digit UTR instant claim',
        status: 'pending',
      },
      { upsert: true }
    );

    return res.status(200).json({
      success: true,
      status: 'pending',
      message: 'UTR registered! Waiting for bank email sync or Admin approval.',
      utr: cleanUtr,
    });
  } catch (err) {
    console.error('[claimUpiUtr] error:', err);
    res.status(500).json({ success: false, message: 'Failed to claim UTR', error: err.message });
  }
};

// 10. Admin: Test Gmail IMAP connection
exports.testGmailConnection = async (req, res) => {
  try {
    const { gmailUser, gmailPassword } = req.body;
    const config = await autoUpiService.getUpiConfig();
    const userToTest = (gmailUser || config.gmailUser || '').trim();
    const passToTest = (gmailPassword || config.gmailPassword || '').trim();

    const result = await autoUpiService.testGmailConnection(userToTest, passToTest);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Test failed: ' + err.message });
  }
};
