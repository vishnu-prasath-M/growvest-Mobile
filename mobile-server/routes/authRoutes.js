const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe, updateUsername, updateMobileNumber, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.put('/username', protect, updateUsername);
router.put('/mobile', protect, updateMobileNumber);
router.put('/update-profile', protect, updateProfile);

module.exports = router;
