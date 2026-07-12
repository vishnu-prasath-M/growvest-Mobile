const express = require('express');
const router = express.Router();
const {
  submitKYC,
  getKYCStatus,
  getAllKYC,
  getKYCDetail,
  reviewKYC,
  getKYCStats,
} = require('../controllers/kycController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/submit', protect, submitKYC);
router.get('/status', protect, getKYCStatus);
router.get('/stats', protect, admin, getKYCStats);
router.get('/all', protect, admin, getAllKYC);
router.get('/:id', protect, admin, getKYCDetail);
router.put('/:id/review', protect, admin, reviewKYC);

module.exports = router;