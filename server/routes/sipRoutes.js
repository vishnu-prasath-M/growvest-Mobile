const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const sipController = require('../controllers/sipController');

// User routes
router.post('/create', protect, sipController.createSIP);
router.post('/verify-payment', protect, sipController.verifyPayment);
router.get('/my', protect, sipController.getMySIPs);
router.get('/:id', protect, sipController.getSIPById);
router.post('/pay-installment', protect, sipController.payInstallment);
router.post('/:id/withdraw', protect, sipController.withdrawSIP);
router.post('/:id/cancel', protect, sipController.cancelSIP);

// Admin routes
router.get('/admin/all', protect, admin, sipController.getAdminSIPs);

module.exports = router;
