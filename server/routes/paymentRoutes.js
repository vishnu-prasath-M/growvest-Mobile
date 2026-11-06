const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/create-order', protect, paymentController.createOrder);
router.post('/verify', protect, paymentController.verifyPayment);
router.post('/check-order-status', protect, paymentController.checkOrderStatus);
router.get('/upi/status/:orderId', paymentController.checkUpiOrderStatus);
router.post('/upi/claim-utr', protect, paymentController.claimUpiUtr);
router.post('/manual/test-gmail', protect, admin, paymentController.testGmailConnection);

// ─── Manual UPI Payment Endpoints ───────────────────────────────────────────
router.get('/manual/config', paymentController.getCompanyUpiDetails);
router.post('/manual/config', protect, admin, paymentController.updateCompanyUpiDetails);
router.post('/manual/submit', protect, paymentController.submitManualPayment);
router.get('/manual/pending', protect, admin, paymentController.getPendingManualPayments);
router.get('/manual/all', protect, admin, paymentController.getAllManualPayments);
router.post('/manual/:id/approve', protect, admin, paymentController.approveManualPayment);
router.post('/manual/:id/reject', protect, admin, paymentController.rejectManualPayment);

// ─── Gateway Webhooks & Callbacks (Preserved for Future) ────────────────────
router.post('/webhook', paymentController.handleWebhook);
router.get('/webhook', paymentController.handleWebhook);
router.get('/callback', paymentController.handleCallback);
router.post('/callback', paymentController.handleCallback);
router.get('/cashfree-checkout', paymentController.renderCashfreeCheckout);

module.exports = router;
