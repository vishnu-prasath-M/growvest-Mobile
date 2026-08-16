const express = require('express');
const router = express.Router();
const pocketMoneyController = require('../controllers/pocketMoneyController');
const { protect, admin } = require('../middleware/authMiddleware');

// Client routes
router.get('/my', protect, pocketMoneyController.getMyPocketMoney);
router.post('/request-payout/:pocketId', protect, pocketMoneyController.requestPayout);
router.get('/payout-status/:pocketId', protect, pocketMoneyController.getPayoutStatus);

// Admin routes
router.get('/admin/all', protect, admin, pocketMoneyController.getAdminPocketMoneyList);
router.get('/admin/stats', protect, admin, pocketMoneyController.getAdminPocketMoneyStats);
router.get('/admin/pending-payouts', protect, admin, pocketMoneyController.getAdminPendingPayouts);
router.post('/admin/trigger-payouts', protect, admin, pocketMoneyController.triggerPocketMoneyPayouts);
router.post('/admin/release/:id', protect, admin, pocketMoneyController.releaseSinglePayout);
router.post('/admin/confirm-release/:payoutId', protect, admin, pocketMoneyController.confirmReleasePayout);

module.exports = router;
