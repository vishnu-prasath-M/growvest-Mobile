const express = require('express');
const router = express.Router();
const {
  getChits,
  getChitById,
  getMyChits,
  getDashboard,
  joinChit,
  makePayment,
  getPaymentHistory,
  getWinners,
  getDividends,
  getChitMembers,
  getAuction,
} = require('../controllers/chitFundController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getChits);
router.get('/my', protect, getMyChits);
router.get('/dashboard', protect, getDashboard);
router.get('/payments', protect, getPaymentHistory);
router.get('/winners', protect, getWinners);
router.get('/dividends', protect, getDividends);
router.get('/:id', protect, getChitById);
router.get('/:id/members', protect, getChitMembers);
router.get('/:id/auction', protect, getAuction);
router.post('/join', protect, joinChit);
router.post('/payment', protect, makePayment);

module.exports = router;