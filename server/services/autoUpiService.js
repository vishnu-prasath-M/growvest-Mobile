'use strict';

const { createUpiPay } = require('codemode-upi-pay');
const { ImapFlow } = require('imapflow');
const MongoStore = require('./upiMongoStore');
const Settings = require('../models/Settings');

let upiInstance = null;
let storeInstance = null;
let syncIntervalTimer = null;
let isSyncing = false;

// Dynamic process handler callback registered from paymentController
let onPaymentPaidCallback = null;

function registerPaymentPaidCallback(cb) {
  onPaymentPaidCallback = cb;
}

// Retrieve settings from DB or ENV
async function getUpiConfig() {
  const upiIdDoc = await Settings.findOne({ key: 'company_upi_id' });
  const payeeNameDoc = await Settings.findOne({ key: 'company_payee_name' });
  const gmailUserDoc = await Settings.findOne({ key: 'canara_gmail_user' });
  const gmailPassDoc = await Settings.findOne({ key: 'canara_gmail_password' });
  const autoApproveDoc = await Settings.findOne({ key: 'canara_auto_approval_enabled' });

  return {
    vpa: (upiIdDoc?.value || process.env.COMPANY_UPI_ID || '8925699005@upi').trim(),
    payeeName: (payeeNameDoc?.value || process.env.COMPANY_PAYEE_NAME || 'Growvest Investments').trim(),
    gmailUser: (gmailUserDoc?.value || process.env.GMAIL_ADDRESS || 'dummy_canara_alerts@gmail.com').trim(),
    gmailPassword: (gmailPassDoc?.value || process.env.GMAIL_APP_PASSWORD || 'abcd efgh ijkl mnop').trim(),
    autoApprovalEnabled: autoApproveDoc ? autoApproveDoc.value === 'true' : true,
  };
}

async function initAutoUpi() {
  if (upiInstance) return upiInstance;

  storeInstance = new MongoStore();
  await storeInstance.init();

  const config = await getUpiConfig();

  const isDummyGmail =
    !config.gmailUser ||
    config.gmailUser.includes('dummy') ||
    !config.gmailPassword ||
    config.gmailPassword.includes('abcd');

  upiInstance = createUpiPay({
    vpa: config.vpa,
    payeeName: config.payeeName,
    gmail: isDummyGmail ? null : { user: config.gmailUser, appPassword: config.gmailPassword },
    store: storeInstance,
    expiresInMinutes: 15,
    refPrefix: 'GV',
    testMode: isDummyGmail, // prevents crash when credentials are dummy
    logger: {
      info: (...args) => console.log('[AutoUPI]', ...args),
      warn: (...args) => console.warn('[AutoUPI]', ...args),
      error: (...args) => console.error('[AutoUPI]', ...args),
    },
  });

  upiInstance.on('paid', async (payment) => {
    console.log(`[AutoUPI] 💰 Payment Confirmed: Order ${payment.orderId}, UTR: ${payment.utr}, Amount: ₹${payment.paidAmount}`);
    if (typeof onPaymentPaidCallback === 'function') {
      try {
        await onPaymentPaidCallback(payment);
      } catch (err) {
        console.error('[AutoUPI] Error executing onPaymentPaid callback:', err);
      }
    }
  });

  upiInstance.on('underpaid', (payment) => {
    console.warn(`[AutoUPI] ⚠️ Underpaid Alert: Order ${payment.orderId}, Expected ₹${payment.payAmount}, Got ₹${payment.paidAmount}`);
  });

  // Start background periodic check if active credentials configured
  startBackgroundSync();

  return upiInstance;
}

function startBackgroundSync() {
  if (syncIntervalTimer) clearInterval(syncIntervalTimer);

  // Periodically trigger sync every 15 seconds
  syncIntervalTimer = setInterval(async () => {
    if (isSyncing || !upiInstance) return;
    try {
      const config = await getUpiConfig();
      if (!config.autoApprovalEnabled) return;

      const isDummy =
        !config.gmailUser ||
        config.gmailUser.includes('dummy') ||
        !config.gmailPassword ||
        config.gmailPassword.includes('abcd');

      if (isDummy) return;

      isSyncing = true;
      await upiInstance.sync();
    } catch (err) {
      // Background sync errors shouldn't crash the server
    } finally {
      isSyncing = false;
    }
  }, 15000);
}

// Reload instance when Admin updates UPI / Gmail settings in dashboard
async function reloadConfig() {
  upiInstance = null;
  return await initAutoUpi();
}

// Test connection to Gmail IMAP
async function testGmailConnection(user, appPassword) {
  if (!user || !appPassword || user.includes('dummy') || appPassword.includes('abcd')) {
    return { success: false, message: 'Please provide valid Gmail address and 16-character App Password.' };
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: user.trim(), pass: String(appPassword).replace(/\s+/g, '') },
    logger: false,
    connectionTimeout: 8000,
    greetingTimeout: 6000,
    socketTimeout: 15000,
    disableAutoIdle: true,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX', { readOnly: true });
    lock.release();
    await client.logout();
    return {
      success: true,
      message: 'Successfully connected to Gmail IMAP! Canara Bank transaction alerts will be auto-processed.',
    };
  } catch (err) {
    return {
      success: false,
      message: `Gmail IMAP Connection Failed: ${err.message}. Make sure 2-Step Verification is ON and you generated an App Password.`,
    };
  }
}

module.exports = {
  initAutoUpi,
  getUpiConfig,
  reloadConfig,
  registerPaymentPaidCallback,
  testGmailConnection,
  getStore: () => storeInstance,
  getUpiInstance: () => upiInstance,
};
