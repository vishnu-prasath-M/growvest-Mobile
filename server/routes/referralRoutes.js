const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const referralController = require('../controllers/referralController');
const walletController = require('../controllers/walletController');
const apkController = require('../controllers/apkController');

// Public APK Routes
router.get('/apk', apkController.getActiveAPK);
router.get('/apk/download', apkController.downloadActiveAPK);

// User Authenticated Routes
router.get('/info', protect, referralController.getReferralInfo);
router.get('/coins', protect, walletController.getCoinWallet);

// Admin Routes
router.get('/admin/overview', protect, admin, apkController.getReferralAdminOverview);
router.post('/admin/apk', protect, admin, apkController.uploadAPK);
router.get('/admin/apk/all', protect, admin, apkController.getAllAPKs);
router.delete('/admin/apk/:id', protect, admin, apkController.deleteAPK);

module.exports = router;
