const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, admin } = require('../middleware/authMiddleware');

// GET /api/users - Get all users (Admin only)
router.get('/', protect, admin, userController.getAllUsers);

// GET /api/users/admin/total-balance - Get total payable balance (Admin only)
router.get('/admin/total-balance', protect, admin, userController.getTotalPayableBalance);

// GET /api/users/detail/:email - Get detailed user info for admin dropdown (Admin only)
router.get('/detail/:email', protect, admin, userController.getUserDetailByEmail);

// GET /api/users/profile - Get current user profile (using token)
router.get('/profile', protect, userController.getUserProfile);

// PUT /api/users/fcm-token - Save FCM push notification token
router.put('/fcm-token', protect, userController.saveFcmToken);

// DELETE /api/users/fcm-token - Remove FCM push notification token
router.delete('/fcm-token', protect, userController.removeFcmToken);

// GET /api/users/email/:email - Get user by email (used by user dashboard)
router.get('/email/:email', userController.getUserByEmail);

// PUT /api/users/email/:email/balance - Update user balance
router.put('/email/:email/balance', userController.updateBalance);

module.exports = router;
