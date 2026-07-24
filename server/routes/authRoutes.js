const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  registerUser,
  loginUser,
  getMe,
  updateUsername,
  updateEmail,
  updateProfile,
  forgotPassword,
  resetPassword,
  verifyResetToken,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Rate limiter for forgot password — max 5 requests per 15 minutes per IP
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { message: 'Too many password reset requests. Please wait 15 minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify-reset-token/:token', verifyResetToken);

// Protected routes
router.get('/me', protect, getMe);
router.put('/username', protect, updateUsername);
router.put('/email', protect, updateEmail);
router.put('/update-profile', protect, updateProfile);

module.exports = router;
