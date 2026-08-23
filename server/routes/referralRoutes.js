const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const referralController = require('../controllers/referralController');
const walletController = require('../controllers/walletController');

// Authenticated Routes
router.get('/info', protect, referralController.getReferralInfo);
router.get('/coins', protect, walletController.getCoinWallet);

module.exports = router;
