const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/create-order', protect, paymentController.createOrder);
router.post('/verify', protect, paymentController.verifyPayment);
router.post('/check-order-status', protect, paymentController.checkOrderStatus);

// ─── Manual UPI Payment Endpoints ───────────────────────────────────────────
router.get('/manual/config', paymentController.getCompanyUpiDetails);
router.post('/manual/config', protect, admin, paymentController.updateCompanyUpiDetails);
router.post('/manual/submit', protect, paymentController.submitManualPayment);
router.post('/sms-webhook', paymentController.handleSmsWebhook);
router.get('/sms-webhook', paymentController.handleSmsWebhook);
router.get('/manual/pending', protect, admin, paymentController.getPendingManualPayments);
router.get('/manual/all', protect, admin, paymentController.getAllManualPayments);
router.post('/manual/:id/approve', protect, admin, paymentController.approveManualPayment);
router.post('/manual/:id/reject', protect, admin, paymentController.rejectManualPayment);

// ─── Zoxy Official Payment Gateway Endpoints (0% Commission) ────────────────
router.post('/zoxy/create-order', protect, paymentController.createZoxyOrder);
router.post('/zoxy/check-status', protect, paymentController.checkZoxyOrderStatus);
router.post('/zoxy-webhook', paymentController.handleZoxyWebhook);
router.get('/zoxy-webhook', paymentController.handleZoxyWebhook);
router.get('/zoxy-callback', paymentController.handleZoxyCallback);
router.post('/zoxy-callback', paymentController.handleZoxyCallback);

// ─── ZapUPI Legacy Aliases (Forward to Zoxy or Compatibility) ───────────────
router.post('/zapupi/create-order', protect, paymentController.createZoxyOrder);
router.post('/zapupi/check-status', protect, paymentController.checkZoxyOrderStatus);
router.post('/zapupi-webhook', paymentController.handleZoxyWebhook);
router.get('/zapupi-webhook', paymentController.handleZoxyWebhook);

// ─── Gateway Webhooks & Callbacks (Preserved for Future) ────────────────────
router.post('/webhook', paymentController.handleWebhook);
router.get('/webhook', paymentController.handleWebhook);
router.get('/callback', paymentController.handleCallback);
router.post('/callback', paymentController.handleCallback);
router.get('/cashfree-checkout', paymentController.renderCashfreeCheckout);

module.exports = router;
