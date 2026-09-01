const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const referralController = require('../controllers/referralController');
const walletController = require('../controllers/walletController');
const apkController = require('../controllers/apkController');

const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024 }, // 150MB limit
});

// Public APK Routes
router.get('/apk', apkController.getActiveAPK);
router.get('/apk/download', apkController.downloadActiveAPK);

// User Authenticated Routes
router.get('/info', protect, referralController.getReferralInfo);
router.get('/coins', protect, walletController.getCoinWallet);
router.post('/daily-login', protect, walletController.claimDailyLogin);
router.post('/withdraw-coins', protect, walletController.requestCoinWithdrawal);

// Admin Routes
router.get('/admin/overview', protect, admin, apkController.getReferralAdminOverview);
router.put('/admin/threshold', protect, admin, walletController.setRewardWithdrawalThreshold);
router.post('/admin/apk', protect, admin, upload.single('apkFile'), apkController.uploadAPK);
router.get('/admin/apk/all', protect, admin, apkController.getAllAPKs);
router.delete('/admin/apk/:id', protect, admin, apkController.deleteAPK);

module.exports = router;
