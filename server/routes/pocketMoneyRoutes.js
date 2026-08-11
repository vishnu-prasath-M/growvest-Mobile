const express = require('express');
const router = express.Router();
const pocketMoneyController = require('../controllers/pocketMoneyController');
const { protect, admin } = require('../middleware/authMiddleware');

// Client routes
router.get('/my', protect, pocketMoneyController.getMyPocketMoney);

// Admin routes
router.get('/admin/all', protect, admin, pocketMoneyController.getAdminPocketMoneyList);
router.get('/admin/stats', protect, admin, pocketMoneyController.getAdminPocketMoneyStats);
router.post('/admin/trigger-payouts', protect, admin, pocketMoneyController.triggerPocketMoneyPayouts);

module.exports = router;
