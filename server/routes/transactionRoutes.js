const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { protect, admin } = require('../middleware/authMiddleware');

// GET /api/transactions - Get current user's own transactions (mobile app uses this endpoint)
router.get('/', protect, transactionController.getMyTransactions);

// GET /api/transactions/all - Get all transactions (admin only)
router.get('/all', protect, admin, transactionController.getAllTransactions);

// GET /api/transactions/my - Get current user transactions
router.get('/my', protect, transactionController.getMyTransactions);

// GET /api/transactions/user/:userEmail - Get user transactions (admin only)
router.get('/user/:userEmail', protect, admin, transactionController.getUserTransactions);

// GET /api/transactions/:id - Get transaction by ID
router.get('/:id', transactionController.getTransactionById);

// POST /api/transactions - Create transaction
router.post('/', transactionController.createTransaction);

module.exports = router;
