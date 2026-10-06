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

module.exports = router;
