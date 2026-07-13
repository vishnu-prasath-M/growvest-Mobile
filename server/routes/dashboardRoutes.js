const express = require('express');
const router = express.Router();
const { getDashboard, getAdminStats } = require('../controllers/dashboardController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/', protect, getDashboard);
router.get('/admin-stats', protect, admin, getAdminStats);

module.exports = router;
