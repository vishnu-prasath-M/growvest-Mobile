const express = require('express');
const router = express.Router();
const { getMyTransactions, getTransactionById } = require('../controllers/transactionController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getMyTransactions);
router.get('/:id', protect, getTransactionById);

module.exports = router;
