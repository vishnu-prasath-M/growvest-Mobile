const crypto = require('crypto');

/**
 * Cashfree Payment Gateway Service
 * 
 * Supports Cashfree PG API v2023-08-01
 * - Sandbox Environment: https://sandbox.cashfree.com/pg
 * - Production Environment: https://api.cashfree.com/pg
 */

const getCashfreeConfig = () => {
  const appId = (process.env.CASHFREE_APP_ID || '').trim();
  const secretKey = (process.env.CASHFREE_SECRET_KEY || '').trim();
  const apiVersion = (process.env.CASHFREE_API_VERSION || '2023-08-01').trim();
  
  // Environment: Auto-detect from APP_ID prefix if not explicitly set
  const explicitEnv = (process.env.CASHFREE_ENV || '').trim().toUpperCase();
  const env = explicitEnv || (appId.startsWith('TEST') ? 'SANDBOX' : 'PRODUCTION');
  const baseUrl = env === 'PRODUCTION' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';

  const isConfigured = Boolean(
    appId &&
    secretKey &&
    !appId.includes('your_app_id') &&
    !secretKey.includes('your_secret_key')
  );

  return {
    appId,
    secretKey,
    apiVersion,
    env,
    baseUrl,
    isConfigured,
  };
};

/**
 * Standard Headers for Cashfree REST API
 */
const getHeaders = () => {
  const { appId, secretKey, apiVersion } = getCashfreeConfig();
  return {
    'Content-Type': 'application/json',
    'x-api-version': apiVersion,
    'x-client-id': appId,
    'x-client-secret': secretKey,
  };
};

/**
 * Helper to sanitize customer details for Cashfree API
 */
const sanitizeCustomer = (user = {}, fallbackMobile = '9999999999') => {
  let customerId = String(user?._id || user?.id || user?.username || `cust_${Date.now()}`)
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 50);
  if (!customerId) customerId = `cust_${Date.now()}`;

  let customerPhone = String(user?.mobileNumber || user?.phone || fallbackMobile || '9999999999')
    .replace(/[^0-9]/g, '');
  if (customerPhone.length > 10) customerPhone = customerPhone.slice(-10);
  if (customerPhone.length < 10) customerPhone = '9999999999';

  let customerName = String(user?.name || user?.username || 'Growvest User')
    .replace(/[^a-zA-Z0-9\s.\-_]/g, '')
    .trim()
    .slice(0, 100);
  if (!customerName) customerName = 'Growvest User';

  let customerEmail = String(user?.email || 'user@growvest.in').trim();
  if (!customerEmail.includes('@')) customerEmail = 'user@growvest.in';

  return { customerId, customerPhone, customerName, customerEmail };
};

/**
 * Create Cashfree Order & Hosted Payment Link
 * 
 * Creates an order via POST /pg/orders (returns payment_session_id)
 * and creates a Payment Link via POST /pg/links (returns link_url for instant mobile/browser redirect)
 */
const createOrder = async ({
  orderId,
  amount,
  user,
  customerMobile,
  customerName: custNameInput,
  customerEmail: custEmailInput,
  purpose = 'Growvest Payment',
  returnUrl: customReturnUrl,
  notifyUrl: customNotifyUrl,
}) => {
  const { baseUrl, isConfigured } = getCashfreeConfig();
  if (!isConfigured) {
    console.warn('[CashfreeService] Credentials not configured; test simulation fallback.');
    return {
      success: false,
      isSimulated: true,
      orderId,
      message: 'Cashfree credentials not configured',
    };
  }

  const numAmount = Math.round(Number(amount));
  const cleanOrderId = String(orderId || `ORD_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`)
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 45);

  const customer = sanitizeCustomer(
    {
      ...user,
      name: custNameInput || user?.name,
      email: custEmailInput || user?.email,
      mobileNumber: customerMobile || user?.mobileNumber,
    },
    customerMobile
  );

  const serverBase = (process.env.APP_URL || 'https://growvest-mobile.onrender.com').replace(/\/+$/, '');
  const returnUrl = customReturnUrl || `${serverBase}/api/payment/callback?order_id=${cleanOrderId}`;
  const notifyUrl = customNotifyUrl || `${serverBase}/api/payment/webhook`;

  // 1. Create Order via POST /pg/orders
  let paymentSessionId = null;
  let cfOrderId = null;
  try {
    const orderPayload = {
      order_id: cleanOrderId,
      order_amount: numAmount,
      order_currency: 'INR',
      customer_details: {
        customer_id: customer.customerId,
        customer_phone: customer.customerPhone,
        customer_name: customer.customerName,
        customer_email: customer.customerEmail,
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: notifyUrl,
      },
      order_note: String(purpose || 'Growvest Payment').slice(0, 150),
    };

    const res = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(orderPayload),
    });

    const data = await res.json();
    if (res.ok && data?.payment_session_id) {
      paymentSessionId = data.payment_session_id;
      cfOrderId = data.cf_order_id;
    } else {
      console.warn('[CashfreeService] /orders notice:', data);
    }
  } catch (err) {
    console.warn('[CashfreeService] /orders error:', err.message);
  }

  // 2. Create Payment Link via POST /pg/links (provides instant link_url for UPI & Hosted checkout)
  let paymentUrl = null;
  let cfLinkId = null;
  try {
    const linkPayload = {
      link_id: cleanOrderId,
      link_amount: numAmount,
      link_currency: 'INR',
      link_purpose: String(purpose || 'Growvest Payment').slice(0, 150),
      customer_details: {
        customer_phone: customer.customerPhone,
        customer_name: customer.customerName,
        customer_email: customer.customerEmail,
      },
      link_meta: {
        return_url: returnUrl,
        notify_url: notifyUrl,
        upi_intent: false,
      },
      link_notify: {
        send_email: false,
        send_sms: false,
      },
    };

    const res = await fetch(`${baseUrl}/links`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(linkPayload),
    });

    const data = await res.json();
    if (res.ok && data?.link_url) {
      paymentUrl = data.link_url;
      cfLinkId = data.cf_link_id;
    } else {
      console.warn('[CashfreeService] /links notice:', data);
    }
  } catch (err) {
    console.warn('[CashfreeService] /links error:', err.message);
  }

  // Fallback payment URL if link creation failed but session succeeded:
  // Hosted checkout page served by our backend utilizing cashfree.js
  if (!paymentUrl && paymentSessionId) {
    paymentUrl = `${serverBase}/api/payment/cashfree-checkout?order_id=${cleanOrderId}&session_id=${paymentSessionId}`;
  }

  return {
    success: true,
    orderId: cleanOrderId,
    paymentUrl,
    paymentSessionId,
    cfOrderId,
    cfLinkId,
    amount: numAmount,
    currency: 'INR',
    gateway: 'cashfree',
    isSimulated: false,
  };
};

/**
 * Check Order Status from Cashfree
 * 
 * Checks GET /pg/orders/{order_id} and GET /pg/orders/{order_id}/payments
 * Fallbacks to GET /pg/links/{order_id}
 */
const checkOrderStatus = async (orderId) => {
  const { baseUrl, isConfigured } = getCashfreeConfig();
  if (!isConfigured) {
    return {
      isPaid: true,
      status: 'SUCCESS',
      isSimulated: true,
      orderId,
      utr: `SIM_UTR_${Date.now()}`,
    };
  }

  const cleanOrderId = String(orderId).trim();
  let orderData = null;
  let paymentsData = [];
  let linkData = null;

  // 1. Fetch Order Details
  try {
    const res = await fetch(`${baseUrl}/orders/${encodeURIComponent(cleanOrderId)}`, {
      headers: getHeaders(),
    });
    if (res.ok) {
      orderData = await res.json();
    }
  } catch (err) {
    console.warn(`[CashfreeService] Fetch order ${cleanOrderId} error:`, err.message);
  }

  // 2. Fetch Payments for Order
  try {
    const res = await fetch(`${baseUrl}/orders/${encodeURIComponent(cleanOrderId)}/payments`, {
      headers: getHeaders(),
    });
    if (res.ok) {
      paymentsData = await res.json();
      if (!Array.isArray(paymentsData)) paymentsData = [];
    }
  } catch (err) {
    console.warn(`[CashfreeService] Fetch payments ${cleanOrderId} error:`, err.message);
  }

  // 3. Fallback: Fetch Link Details if order not found
  if (!orderData) {
    try {
      const res = await fetch(`${baseUrl}/links/${encodeURIComponent(cleanOrderId)}`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        linkData = await res.json();
      }
    } catch (err) {
      console.warn(`[CashfreeService] Fetch link ${cleanOrderId} error:`, err.message);
    }
  }

  // Check for successful payment attempt in payments array
  const successfulPayment = Array.isArray(paymentsData)
    ? paymentsData.find((p) => String(p?.payment_status).toUpperCase() === 'SUCCESS')
    : null;

  const isOrderPaid = String(orderData?.order_status).toUpperCase() === 'PAID';
  const isLinkPaid = String(linkData?.link_status).toUpperCase() === 'PAID' || (Number(linkData?.link_amount_paid || 0) >= Number(linkData?.link_amount || 1));

  if (successfulPayment || isOrderPaid || isLinkPaid) {
    const utr =
      successfulPayment?.bank_reference ||
      successfulPayment?.cf_payment_id ||
      orderData?.cf_order_id ||
      linkData?.cf_link_id ||
      `UTR_CF_${cleanOrderId}`;

    return {
      isPaid: true,
      status: 'SUCCESS',
      orderId: cleanOrderId,
      utr,
      paymentId: successfulPayment?.cf_payment_id || utr,
      amount: successfulPayment?.payment_amount || orderData?.order_amount || linkData?.link_amount || 0,
      paymentDetails: successfulPayment || orderData || linkData,
    };
  }

  // Check pending status
  const isOrderActive = String(orderData?.order_status).toUpperCase() === 'ACTIVE';
  const isLinkActive = String(linkData?.link_status).toUpperCase() === 'ACTIVE';
  if (isOrderActive || isLinkActive) {
    return {
      isPaid: false,
      isPending: true,
      status: 'PENDING',
      orderId: cleanOrderId,
      message: 'Payment is pending. Please complete transaction or wait a moment.',
    };
  }

  // Failed or Expired
  return {
    isPaid: false,
    isFailed: true,
    status: 'FAILED',
    orderId: cleanOrderId,
    message: orderData?.order_status || linkData?.link_status || 'Payment failed or was not completed.',
  };
};

/**
 * Verify Webhook Signature (Cashfree v2023-08-01)
 * 
 * Signature = Base64( HMAC-SHA256( timestamp + rawBody, secretKey ) )
 */
const verifyWebhookSignature = (signature, timestamp, rawBody) => {
  const { secretKey } = getCashfreeConfig();
  if (!signature || !timestamp || !rawBody) {
    return false;
  }
  try {
    const signedPayload = String(timestamp) + String(rawBody);
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(signedPayload)
      .digest('base64');

    return expectedSignature === signature;
  } catch (err) {
    console.error('[CashfreeService] Webhook signature verify error:', err.message);
    return false;
  }
};

module.exports = {
  getCashfreeConfig,
  createOrder,
  checkOrderStatus,
  verifyWebhookSignature,
};
