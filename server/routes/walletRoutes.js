const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const walletController = require('../controllers/walletController');

// ─── Cash Wallet Routes ──────────────────────────────────────────────────────
router.get('/overview', protect, walletController.getWalletOverview);
router.get('/balance', protect, walletController.getWalletBalance);
router.post('/pay', protect, walletController.payFromWallet);

// ─── Coin / Rewards Wallet Routes (Preserving full backward compatibility) ────
router.get('/coins', protect, walletController.getCoinWallet);
router.post('/daily-login', protect, walletController.claimDailyLogin);
router.post('/withdraw-coins', protect, walletController.requestCoinWithdrawal);
router.put('/admin/threshold', protect, admin, walletController.setRewardWithdrawalThreshold);

module.exports = router;

