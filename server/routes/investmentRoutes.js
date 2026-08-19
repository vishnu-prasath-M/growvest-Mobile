const express = require('express');
const router = express.Router();
const investmentController = require('../controllers/investmentController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/plans', protect, investmentController.getPlans);
router.post('/', protect, investmentController.createInvestment);
router.get('/', protect, investmentController.getInvestments);
router.patch('/:id/status', protect, admin, investmentController.updateInvestmentStatus);
router.post('/:id/withdraw', protect, investmentController.withdrawInvestment);

module.exports = router;
