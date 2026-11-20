const express = require('express');
const router = express.Router();
const chargeController = require('../controllers/chargeController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Public route for mobile app & client
router.get('/', chargeController.getCharges);

// Admin routes
router.get('/admin', protect, adminOnly, chargeController.getAdminCharges);
router.put('/admin', protect, adminOnly, chargeController.updateAdminCharges);
router.patch('/admin', protect, adminOnly, chargeController.updateAdminCharges);

module.exports = router;

