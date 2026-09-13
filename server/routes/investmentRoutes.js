const express = require('express');
const router = express.Router();
const investmentController = require('../controllers/investmentController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/plans', protect, investmentController.getPlans);
router.get('/summary', protect, investmentController.getInvestmentSummary);
router.post('/calculate-tier', protect, investmentController.calculateTier);
router.post('/reinvest', protect, investmentController.reinvestInvestment);
router.post('/:id/reinvest', protect, investmentController.reinvestInvestment);
router.post('/', protect, investmentController.createInvestment);
router.get('/', protect, investmentController.getInvestments);
router.patch('/:id/status', protect, admin, investmentController.updateInvestmentStatus);
router.post('/:id/withdraw', protect, investmentController.withdrawInvestment);

module.exports = router;
