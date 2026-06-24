const express = require('express');
const router = express.Router();
const { createWithdrawal, getMyWithdrawals, getWithdrawalById } = require('../controllers/withdrawalController');
const { protect } = require('../middleware/auth');

router.post('/', protect, createWithdrawal);
router.get('/', protect, getMyWithdrawals);
router.get('/:id', protect, getWithdrawalById);

module.exports = router;
