const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Public route for mobile app
router.get('/', bannerController.getActiveBanners);

// Admin routes
router.get('/admin/all', protect, adminOnly, bannerController.getAllBanners);
router.post('/admin', protect, adminOnly, bannerController.createBanner);
router.patch('/admin/:id', protect, adminOnly, bannerController.updateBanner);
router.delete('/admin/:id', protect, adminOnly, bannerController.deleteBanner);

module.exports = router;
