const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

router.post('/create-order', protect, paymentController.createOrder);
router.post('/verify', protect, paymentController.verifyPayment);
router.post('/check-order-status', protect, paymentController.checkOrderStatus);

// Webhook endpoint called by the Payment Gateway server (public, no auth middleware)
router.post('/webhook', paymentController.handleWebhook);
router.get('/webhook', paymentController.handleWebhook);

// ─── Payment Gateway Callback (after user completes payment in browser) ───────
// The gateway redirects to this URL after payment. We redirect back to the app
// via deep link so the user is returned to Growvest automatically.
router.get('/callback', paymentController.handleCallback);
router.post('/callback', paymentController.handleCallback);

// ─── Cashfree Web Checkout Page ─────────────────────────────────────────────
// Hosted checkout interface using Cashfree JS SDK v3
router.get('/cashfree-checkout', paymentController.renderCashfreeCheckout);

module.exports = router;
