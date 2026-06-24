const express = require('express');
const router = express.Router();
const { createInvestment, getInvestments, getInvestmentById } = require('../controllers/investmentController');
const { protect } = require('../middleware/auth');

router.post('/', protect, createInvestment);
router.get('/', protect, getInvestments);
router.get('/:id', protect, getInvestmentById);

module.exports = router;
