const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const BankCreditAlert = require('../models/BankCreditAlert');
const ManualPayment = require('../models/ManualPayment');
const PendingPayment = require('../models/PendingPayment');
const Settings = require('../models/Settings');
const { sendNotification } = require('./notificationHelper');

// Dummy defaults — replace with your real Gmail + 16-char Google App Password in .env or Admin Settings
const DUMMY_GMAIL_USER = 'your-slice-alerts@gmail.com';
const DUMMY_GMAIL_PASS = 'abcd efgh ijkl mnop';
const DEFAULT_SMS_SECRET = 'growvest_slice_sms_2026';

class AutoUpiService {
  constructor() {
    this.pollTimer = null;
    this.isPolling = false;
    this.loggedDummyNotice = false;
    this.processSuccessfulOrderFn = null;
  }

  /**
   * Inject processSuccessfulOrder to avoid circular require issues with paymentController
   */
  setOrderProcessor(fn) {
    this.processSuccessfulOrderFn = fn;
  }

  async getUpiConfig() {
    try {
      const [userSet, passSet, enabledSet, smsSecretSet] = await Promise.all([
        Settings.findOne({ key: 'canara_gmail_user' }),
        Settings.findOne({ key: 'canara_gmail_password' }),
        Settings.findOne({ key: 'canara_auto_approval_enabled' }),
        Settings.findOne({ key: 'sms_webhook_secret' }),
      ]);

      const gmailUser = (
        process.env.SLICE_GMAIL_USER ||
        process.env.GMAIL_USER ||
        userSet?.value ||
        DUMMY_GMAIL_USER
      ).trim();

      const gmailPassword = (
        process.env.SLICE_GMAIL_APP_PASSWORD ||
        process.env.GMAIL_APP_PASSWORD ||
        passSet?.value ||
        DUMMY_GMAIL_PASS
      ).trim();

      const autoApprovalEnabled =
        enabledSet !== null && enabledSet !== undefined
          ? enabledSet.value === 'true'
          : true;

      const smsWebhookSecret = (
        process.env.SMS_WEBHOOK_SECRET ||
        smsSecretSet?.value ||
        DEFAULT_SMS_SECRET
      ).trim();

      return {
        gmailUser,
        gmailPassword,
        autoApprovalEnabled,
        smsWebhookSecret,
      };
    } catch (err) {
      return {
        gmailUser: process.env.SLICE_GMAIL_USER || DUMMY_GMAIL_USER,
        gmailPassword: process.env.SLICE_GMAIL_APP_PASSWORD || DUMMY_GMAIL_PASS,
        autoApprovalEnabled: true,
        smsWebhookSecret: process.env.SMS_WEBHOOK_SECRET || DEFAULT_SMS_SECRET,
      };
    }
  }

  isDummyCredentials(gmailUser, gmailPassword) {
    if (!gmailUser || !gmailPassword) return true;
    const u = gmailUser.toLowerCase();
    const p = gmailPassword.toLowerCase().replace(/\s+/g, '');
    return (
      u.includes('your-slice-alerts') ||
      u.includes('example.com') ||
      p.includes('abcdefghijklmnop') ||
      p.includes('dummy') ||
      p.length < 12
    );
  }

  /**
   * Parse slice bank Gmail alert OR slice bank SMS text.
   * Supports:
   * - Gmail: "Received ₹1 in your slice account ... RRN 350373264270 ... From VISHNU PRASATH M"
   * - SMS: "Rs. 700 received in slice A/c xx7825 on 20-Nov-26 from Mrs Selvakumari S via UPI (Ref ID: 669059574252)."
   */
  parseSliceCreditText(text, subject = '') {
    const combined = `${subject}\n${text || ''}`.replace(/\s+/g, ' ').trim();
    if (!combined) return null;

    // Must be an incoming credit/received alert (ignore debits / sent)
    const isCredit = /\b(received|credited)\b/i.test(combined) && !/\b(debited|sent|paid\s+to)\b/i.test(combined);
    if (!isCredit) return null;

    // 1. Extract Amount (e.g., "Rs. 700", "₹1", "credited with INR 1.00")
    let amount = null;
    const amtPatterns = [
      /(?:received|credited)(?:\s+(?:with|for|of|by))?\s*(?:₹|Rs\.?|INR)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
      /(?:₹|Rs\.?|INR)\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:received|credited)/i,
    ];
    for (const regex of amtPatterns) {
      const m = combined.match(regex);
      if (m && m[1]) {
        const parsed = parseFloat(m[1].replace(/,/g, ''));
        if (!Number.isNaN(parsed) && parsed > 0) {
          amount = parsed;
          break;
        }
      }
    }

    // 2. Extract 12-digit UTR / RRN / Ref ID / UPI Ref No
    let utr = null;
    const utrPatterns = [
      /(?:RRN|UPI\s*Ref\s*No\.?|Ref\s*ID|Ref\s*No\.?|UTR|Reference(?:\s*No\.?)?)[:\s#-]*(\d{12})\b/i,
      /\b(\d{12})\b/,
    ];
    for (const regex of utrPatterns) {
      const m = combined.match(regex);
      if (m && m[1]) {
        utr = m[1];
        break;
      }
    }

    if (!amount || !utr) return null;

    // 3. Extract Sender (optional)
    let sender = '';
    const senderMatch = combined.match(/\bfrom\s+([A-Za-z0-9\s\.&]+?)(?:\s+via\s+UPI|\s+RRN|\s+\(Ref|\s+on\s+\d|$)/i);
    if (senderMatch && senderMatch[1]) {
      sender = senderMatch[1].trim();
    }

    return { amount, utr, sender, rawText: combined.slice(0, 500) };
  }

  /**
   * Record a parsed bank alert and immediately auto-approve any matching pending ManualPayment
   */
  async recordAndMatchAlert({ utr, amount, sender = '', source = 'gmail', rawText = '' }) {
    if (!utr || !amount) return { recorded: false, matched: false };

    const cleanUtr = String(utr).trim();
    let alert = await BankCreditAlert.findOne({ utr: cleanUtr });
    if (!alert) {
      alert = await BankCreditAlert.create({
        utr: cleanUtr,
        amount: Number(amount),
        sender,
        source,
        rawText,
        receivedAt: new Date(),
      });
      console.log(`[AutoUPI] Recorded ${source.toUpperCase()} bank credit alert: ₹${amount}, UTR=${cleanUtr}`);
    }

    if (alert.matched) {
      return { recorded: true, matched: true, alreadyMatched: true, orderId: alert.matchedOrderId };
    }

    // Find a pending ManualPayment matching this UTR and Amount
    const pendingManual = await ManualPayment.findOne({
      utr: cleanUtr,
      status: 'pending',
    }).populate('userId');

    if (!pendingManual) {
      return { recorded: true, matched: false, message: 'Alert stored; awaiting user UTR submission.' };
    }

    // Verify amount matches (within ₹1 tolerance)
    if (Math.abs(Number(pendingManual.amount) - Number(alert.amount)) > 1) {
      console.warn(
        `[AutoUPI] UTR ${cleanUtr} matched, but amount mismatch! Submitted ₹${pendingManual.amount} vs Bank ₹${alert.amount}`
      );
      return { recorded: true, matched: false, reason: 'amount_mismatch' };
    }

    return await this._approveManualRecord(pendingManual, alert);
  }

  /**
   * Called right when user submits ManualPayment: checks if bank alert ALREADY arrived
   */
  async tryAutoApprovePendingManual(manualRecord) {
    if (!manualRecord || manualRecord.status !== 'pending' || !manualRecord.utr) {
      return { matched: false };
    }

    const alert = await BankCreditAlert.findOne({
      utr: String(manualRecord.utr).trim(),
      matched: false,
    });

    if (!alert) return { matched: false };

    if (Math.abs(Number(manualRecord.amount) - Number(alert.amount)) > 1) {
      console.warn(
        `[AutoUPI] Pre-received alert UTR ${alert.utr} amount mismatch: User ₹${manualRecord.amount} vs Bank ₹${alert.amount}`
      );
      return { matched: false };
    }

    const populated = await ManualPayment.findById(manualRecord._id).populate('userId');
    return await this._approveManualRecord(populated || manualRecord, alert);
  }

  async _approveManualRecord(manualPayment, alert) {
    try {
      const processor =
        this.processSuccessfulOrderFn ||
        require('../controllers/paymentController').processSuccessfulOrder;

      if (typeof processor !== 'function') {
        console.error('[AutoUPI] Order processor not available yet.');
        return { matched: false };
      }

      const processRes = await processor(
        manualPayment.orderId,
        manualPayment.utr,
        manualPayment.userId,
        manualPayment.paymentType,
        manualPayment.payloadData
      );

      if (!processRes || !processRes.success) {
        console.error(`[AutoUPI] Failed to process order ${manualPayment.orderId}:`, processRes?.message);
        return { matched: false, error: processRes?.message };
      }

      manualPayment.status = 'approved';
      manualPayment.reviewedAt = new Date();
      manualPayment.adminRemarks = `Auto-approved via ${alert.source.toUpperCase()} bank alert (UTR: ${alert.utr})`;
      await manualPayment.save();

      await PendingPayment.findOneAndUpdate(
        { orderId: manualPayment.orderId },
        { status: 'completed', completedAt: new Date() }
      ).catch(() => {});

      alert.matched = true;
      alert.matchedOrderId = manualPayment.orderId;
      alert.matchedAt = new Date();
      await alert.save();

      try {
        await sendNotification({
          userId: manualPayment.userId?._id || manualPayment.userId,
          title: 'Payment Auto-Approved! ✅',
          description: `Your payment of ₹${Number(manualPayment.amount).toLocaleString('en-IN')} (UTR: ${manualPayment.utr}) was verified automatically. Your ${String(manualPayment.paymentType || 'plan').replace(/_/g, ' ')} is now active!`,
          type: 'general',
        });
      } catch (_) {}

      console.log(`[AutoUPI] ✅ Auto-approved order ${manualPayment.orderId} via ${alert.source} (UTR: ${alert.utr})`);
      return { recorded: true, matched: true, orderId: manualPayment.orderId };
    } catch (err) {
      console.error('[AutoUPI] _approveManualRecord error:', err);
      return { matched: false, error: err.message };
    }
  }

  /**
   * Poll Gmail inbox for recent slice bank credit alerts
   */
  async checkGmailAlertsOnce() {
    if (this.isPolling) return;
    this.isPolling = true;

    let client = null;
    try {
      const { gmailUser, gmailPassword, autoApprovalEnabled } = await this.getUpiConfig();
      if (!autoApprovalEnabled) return;

      if (this.isDummyCredentials(gmailUser, gmailPassword)) {
        if (!this.loggedDummyNotice) {
          console.log(
            '[AutoUPI] Gmail Auto-Approval is on standby (dummy credentials detected). Set SLICE_GMAIL_USER & SLICE_GMAIL_APP_PASSWORD when ready.'
          );
          this.loggedDummyNotice = true;
        }
        return;
      }

      client = new ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: {
          user: gmailUser,
          pass: gmailPassword.replace(/\s+/g, ''),
        },
        logger: false,
      });

      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        // Search recent emails from the last 2 days
        const sinceDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
        const uids = await client.search({ since: sinceDate });
        const recentUids = uids.slice(-25); // Inspect up to last 25 emails

        for (const uid of recentUids) {
          try {
            const msg = await client.fetchOne(uid, { source: true }, { uid: true });
            if (!msg || !msg.source) continue;

            const parsed = await simpleParser(msg.source);
            const subject = parsed.subject || '';
            const textBody = parsed.text || '';

            // Filter quickly for slice / received alerts
            if (!/slice|received|credited|rrn/i.test(`${subject} ${textBody}`)) continue;

            const extracted = this.parseSliceCreditText(textBody, subject);
            if (extracted) {
              await this.recordAndMatchAlert({
                ...extracted,
                source: 'gmail',
              });
            }
          } catch (msgErr) {
            console.warn('[AutoUPI] Single email parse warning:', msgErr.message);
          }
        }
      } finally {
        lock.release();
      }
    } catch (err) {
      console.warn('[AutoUPI] Gmail check warning:', err.message);
    } finally {
      if (client) {
        await client.logout().catch(() => {});
      }
      this.isPolling = false;
    }
  }

  async testGmailConnection(gmailUser, gmailPassword) {
    if (this.isDummyCredentials(gmailUser, gmailPassword)) {
      return {
        success: false,
        message: 'Dummy Gmail App Password is currently configured. Replace it with your real 16-character Google App Password to enable Gmail Auto-Approval.',
      };
    }

    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: gmailUser,
        pass: String(gmailPassword).replace(/\s+/g, ''),
      },
      logger: false,
    });

    try {
      await client.connect();
      await client.logout();
      return { success: true, message: `Successfully connected to Gmail IMAP for ${gmailUser}!` };
    } catch (err) {
      return { success: false, message: `Gmail IMAP login failed: ${err.message}` };
    }
  }

  startPolling(intervalMs = 35000) {
    if (this.pollTimer) clearInterval(this.pollTimer);
    // Run initial check 10s after boot, then every 35s
    setTimeout(() => {
      this.checkGmailAlertsOnce().catch(() => {});
    }, 10000);
    this.pollTimer = setInterval(() => {
      this.checkGmailAlertsOnce().catch(() => {});
    }, intervalMs);
  }

  async reloadConfig() {
    this.loggedDummyNotice = false;
    await this.checkGmailAlertsOnce().catch(() => {});
  }
}

module.exports = new AutoUpiService();

