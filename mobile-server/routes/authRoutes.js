const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  registerUser,
  loginUser,
  getMe,
  updateUsername,
  updateMobileNumber,
  updateProfile,
  forgotPassword,
  resetPassword,
  verifyResetToken,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many password reset requests. Please wait 15 minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/verify-reset-token/:token', verifyResetToken);

router.get('/me', protect, getMe);
router.put('/username', protect, updateUsername);
router.put('/mobile', protect, updateMobileNumber);
router.put('/update-profile', protect, updateProfile);

module.exports = router;
