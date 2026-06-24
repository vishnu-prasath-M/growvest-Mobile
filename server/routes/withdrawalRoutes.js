const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/', protect, withdrawalController.createWithdrawal);
router.get('/', protect, withdrawalController.getWithdrawals);
router.patch('/:id/status', protect, admin, withdrawalController.updateWithdrawalStatus);
router.post('/migrate-unprocessed', protect, admin, withdrawalController.migrateUnprocessedPaidWithdrawals);

module.exports = router;
