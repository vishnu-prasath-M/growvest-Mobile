const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');

// Admin controller (existing)
const chitAdminController = require('../controllers/chitAdminController');

// User-facing controller (new)
const chitController = require('../controllers/chitController');

// ─────────────────────────────────────────────
// USER-FACING ROUTES (authenticated users only)
// ─────────────────────────────────────────────

// Dashboard summary for logged-in user
router.get('/dashboard', protect, chitController.getDashboard);

// Logged-in user's memberships
router.get('/my', protect, chitController.getMyChits);

// Logged-in user's payment history (with optional ?chitId= filter)
router.get('/payments', protect, chitController.getPaymentHistory);

// Winner history (with optional ?chitId= filter)
router.get('/winners', protect, chitController.getWinners);

// Dividend history for logged-in user
router.get('/dividends', protect, chitController.getDividends);

// Join a chit fund
router.post('/join', protect, chitController.joinChit);

// Submit monthly payment
router.post('/payment', protect, chitController.makePayment);

// ─────────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────────

// Admin: overview stats
router.get('/overview', protect, admin, chitAdminController.getOverview);

// Admin: pending chit payments
router.get('/pending-payments', protect, admin, chitAdminController.getPendingPayments);

// Admin: pending join requests
router.get('/join-requests', protect, admin, chitAdminController.getJoinRequests);

// Admin: approve/reject a chit payment
router.patch('/payment/:id/status', protect, admin, chitAdminController.updatePaymentStatus);

// Admin: approve/reject a join request
router.patch('/join/:id/status', protect, admin, chitAdminController.updateJoinStatus);

// Admin: create chit
router.post('/', protect, admin, chitAdminController.createChit);

// Admin: update chit
router.put('/:id', protect, admin, chitAdminController.updateChit);

// Admin: change chit status (pause, resume, close, archive)
router.patch('/:id/status', protect, admin, chitAdminController.changeChitStatus);

// Admin: delete chit
router.delete('/:id', protect, admin, chitAdminController.deleteChit);

// ─────────────────────────────────────────────
// PUBLIC / GENERAL ROUTES
// ─────────────────────────────────────────────

// Get all chits (public listing — active & upcoming plans)
router.get('/', protect, chitController.getAllChits);

// Get single chit with user membership status
router.get('/:id', protect, chitController.getChitById);

// Get members of a chit
router.get('/:id/members', protect, chitController.getChitMembers);

module.exports = router;
