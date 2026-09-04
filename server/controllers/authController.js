const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../services/emailService');

// Helper to generate token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', {
    expiresIn: '30d',
  });
};

exports.registerUser = async (req, res) => {
  try {
    const { username, mobileNumber, password, email } = req.body;
    const name = req.body.name || username;

    if (!username || !mobileNumber || !password) {
      return res.status(400).json({ message: 'Please provide all fields' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    const userExists = await User.findOne({ $or: [{ username }, { mobileNumber }, { email: email.trim().toLowerCase() }] });

    if (userExists) {
      return res.status(400).json({ message: 'User with this username, mobile number or email already exists' });
    }

    // Generate unique referral code for new user
    let userReferralCode = '';
    let isUnique = false;
    while (!isUnique) {
      userReferralCode = 'GV' + Math.random().toString(36).substring(2, 6).toUpperCase();
      const count = await User.countDocuments({ referralCode: userReferralCode });
      if (count === 0) isUnique = true;
    }

    // Check optional referral code passed during registration (supports referralCode, username, or phone)
    const rawRefInput = (req.body.referralCode || req.body.ref || '').toString().trim();
    let referrer = null;
    if (rawRefInput) {
      referrer = await User.findOne({
        $or: [
          { referralCode: new RegExp(`^${rawRefInput}$`, 'i') },
          { username: new RegExp(`^${rawRefInput}$`, 'i') },
          { mobileNumber: rawRefInput }
        ]
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Give 20 welcome coins to new user if referred, otherwise 10 welcome coins
    const initialCoins = referrer ? 20 : 10;

    const user = await User.create({
      username,
      name,
      mobileNumber,
      email,
      password: hashedPassword,
      referralCode: userReferralCode,
      referredBy: referrer ? referrer._id : null,
      coinBalance: initialCoins,
    });

    if (user) {
      // Create Referral record and reward referrer 20 Coins upon registration
      if (referrer && referrer._id.toString() !== user._id.toString()) {
        try {
          const Referral = require('../models/Referral');
          const ReferralLead = require('../models/ReferralLead');
          const { triggerReferralSignupReward } = require('../utils/referralHelper');

          await Referral.create({
            referrerUserId: referrer._id,
            referredUserId: user._id,
            referralCode: referrer.referralCode || rawRefInput.toUpperCase(),
            rewardCoins: 0,
            status: 'REGISTERED',
          });

          // Mark any active downloaded leads for this referral as registered
          try {
            await ReferralLead.updateMany(
              { referrerUserId: referrer._id, status: 'DOWNLOADED' },
              { status: 'REGISTERED', registeredUserId: user._id }
            );
          } catch (leadUpdateErr) {
            console.warn('[ReferralLead Update Warning]', leadUpdateErr.message);
          }

          await triggerReferralSignupReward(user._id, referrer._id);
        } catch (refErr) {
          console.error('[Referral Attribution Error]', refErr.message);
        }
      }

      res.status(201).json({
        _id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        referralCode: user.referralCode,
        coinBalance: user.coinBalance,
        createdAt: user.createdAt,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body; // 'email' can be email or mobileNumber

    console.log('[Login] Attempting login with identifier:', email);

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide all fields' });
    }

    const identifier = typeof email === 'string' ? email.trim() : email;

    // Allow login via email OR mobileNumber OR username (case-insensitive for email/username)
    const user = await User.findOne({ 
      $or: [
        { email: { $regex: new RegExp(`^${identifier}$`, 'i') } },
        { mobileNumber: identifier },
        { username: { $regex: new RegExp(`^${identifier}$`, 'i') } }
      ]
    });

    console.log('[Login] User found:', user ? user.username : 'No');

    if (!user) {
      return res.status(404).json({ message: 'User not found. Please sign up.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    console.log('[Login] Password match:', isMatch);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.referralCode) {
      let code = '';
      let isUnique = false;
      while (!isUnique) {
        code = 'GV' + Math.random().toString(36).substring(2, 6).toUpperCase();
        const count = await User.countDocuments({ referralCode: code });
        if (count === 0) isUnique = true;
      }
      user.referralCode = code;
      await User.findByIdAndUpdate(user._id, { referralCode: code });
    }

    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      mobileNumber: user.mobileNumber,
      referralCode: user.referralCode,
      coinBalance: user.coinBalance || 0,
      role: user.role,
      createdAt: user.createdAt,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error('[Login] Error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (user) {
      if (!user.referralCode) {
        let code = '';
        let isUnique = false;
        while (!isUnique) {
          code = 'GV' + Math.random().toString(36).substring(2, 6).toUpperCase();
          const count = await User.countDocuments({ referralCode: code });
          if (count === 0) isUnique = true;
        }
        user.referralCode = code;
        await User.findByIdAndUpdate(user._id, { referralCode: code });
      }

      res.json({
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        mobileNumber: user.mobileNumber,
        referralCode: user.referralCode,
        coinBalance: user.coinBalance || 0,
        role: user.role,
        balance: user.balance,
        createdAt: user.createdAt,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update email address
// @route   PUT /api/auth/email
// @access  Private
exports.updateEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!trimmedEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    const userId = req.user._id || req.user.id;

    // Exclude current user so updating to the same email is allowed
    const existingUser = await User.findOne({
      email: trimmedEmail,
      _id: { $ne: userId },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Email address already in use' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { email: trimmedEmail },
      { new: true, runValidators: false }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
      balance: user.balance,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Update email error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email address already in use' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateUsername = async (req, res) => {
  try {
    const { username } = req.body;
    const trimmedUsername = typeof username === 'string' ? username.trim() : '';

    if (!trimmedUsername) {
      return res.status(400).json({ message: 'Username is required' });
    }

    const userId = req.user._id || req.user.id;

    const existingUser = await User.findOne({
      username: trimmedUsername,
      _id: { $ne: userId },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { username: trimmedUsername, name: trimmedUsername },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
      balance: user.balance,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Update username error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Username already taken' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user profile (username, mobileNumber, name, email)
// @route   PUT /api/auth/update-profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { username, mobileNumber, name, email } = req.body;
    const updateFields = {};
    const userId = req.user._id || req.user.id;

    console.log('[updateProfile] Request body:', { username, mobileNumber, name, email });
    console.log('[updateProfile] User ID:', userId);

    // Fetch current user from MongoDB to determine state for branching logic
    const currentUser = await User.findById(userId).select('email username mobileNumber');
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (username && typeof username === 'string' && username.trim()) {
      const trimmedUsername = username.trim();
      const existingUser = await User.findOne({
        username: trimmedUsername,
        _id: { $ne: userId },
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      updateFields.username = trimmedUsername;
      updateFields.name = trimmedUsername;
    }

    if (mobileNumber && typeof mobileNumber === 'string' && mobileNumber.trim()) {
      const trimmedMobile = mobileNumber.trim();
      if (!/^\d{10}$/.test(trimmedMobile)) {
        return res.status(400).json({ message: 'Invalid mobile number. Must be 10 digits.' });
      }

      const existingMobile = await User.findOne({
        mobileNumber: trimmedMobile,
        _id: { $ne: userId },
      });
      if (existingMobile) {
        return res.status(400).json({ message: 'Mobile number already in use' });
      }
      updateFields.mobileNumber = trimmedMobile;
    }

    if (name && typeof name === 'string' && name.trim()) {
      updateFields.name = name.trim();
    }

    // Email handling — branching based on MongoDB state (NOT frontend state)
    if (email && typeof email === 'string' && email.trim()) {
      const trimmedEmail = email.trim().toLowerCase();

      if (!currentUser.email) {
        // ============================================================
        // CASE 1: First-time email save
        // MongoDB has NO email → This is a FIRST SAVE, not an update.
        // Reuse signup-style email uniqueness check:
        // During signup (registerUser), we check:
        //   User.findOne({ $or: [..., { email }] })
        // Here we check if ANY user has this email.
        // ============================================================
        console.log('[updateProfile] CASE 1: First-time email save for user', userId);
        const existingEmail = await User.findOne({ email: trimmedEmail });
        if (existingEmail) {
          return res.status(400).json({ message: 'Email address already in use' });
        }
      } else {
        // ============================================================
        // CASE 2: Update existing email
        // MongoDB already has email → This is an UPDATE.
        // Reuse profile update uniqueness check (exclude current user).
        // ============================================================
        console.log('[updateProfile] CASE 2: Update existing email for user', userId, 'current email:', currentUser.email);
        const existingEmail = await User.findOne({
          email: trimmedEmail,
          _id: { $ne: userId },
        });
        if (existingEmail) {
          return res.status(400).json({ message: 'Email address already in use' });
        }
      }

      // Both cases save/update the email on the User document via $set
      updateFields.email = trimmedEmail;
      console.log('[updateProfile] Email set on updateFields:', trimmedEmail);
    }

    console.log('[updateProfile] Update fields:', updateFields);

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateFields,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
      balance: user.balance,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Username, mobile number or email already in use' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── Token expiry config ──────────────────────────────────────────────────────
const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

// ─── Hash a plain token with SHA-256 ─────────────────────────────────────────
const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

// @desc    Forgot Password — generate token and send reset email
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  console.log('[Trace] 1. Request received at POST /api/auth/forgot-password');
  try {
    const { email } = req.body;
    const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!trimmedEmail) {
      console.warn('[Trace] Validation failed: Email address is required');
      return res.status(400).json({ message: 'Email address is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      console.warn('[Trace] Validation failed: Invalid email format');
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    // Find user in MongoDB
    const user = await User.findOne({ email: { $regex: new RegExp(`^${trimmedEmail}$`, 'i') } });

    if (!user) {
      console.warn(`[Trace] 2. User NOT found for email: ${trimmedEmail}`);
      return res.status(404).json({ message: 'No account found with this email address.' });
    }
    console.log(`[Trace] 2. User found: ID ${user._id}`);

    // Generate a secure random token (plain text — sent in link)
    const plainToken = crypto.randomBytes(32).toString('hex');
    console.log('[Trace] 3. Secure token generated');

    // Store only the hashed version — NEVER the plain token
    user.passwordResetToken = hashToken(plainToken);
    user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
    await user.save({ validateBeforeSave: false });
    console.log('[Trace] 4. Hashed token saved in MongoDB');

    // Build reset URL
    const webHost = process.env.APP_URL || 'https://growvest-mobile.onrender.com';
    const resetWebUrl = `${webHost}/reset-password?token=${plainToken}`;

    try {
      console.log('[Trace] 5. Resend request started');
      await sendPasswordResetEmail(user.email, resetWebUrl, 15);
      console.log(`[Trace] 6. Resend response success for ${user.email}`);
      console.log('[Trace] 7. API response sent to client');
      return res.json({
        message: 'Password reset link has been sent to your email address.',
      });
    } catch (emailError) {
      // Clean up the token if email fails — don't leave a dangling token
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      await user.save({ validateBeforeSave: false });
      console.error('[Trace Error] Resend Email send error:', emailError.message);
      return res.status(400).json({
        message: emailError.message || 'Failed to send reset email via Resend.',
      });
    }
  } catch (error) {
    console.error('[Trace Error] Server Error:', error);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// @desc    Reset Password — validate token and set new password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    // Hash the incoming plain token to compare with the stored hash
    const hashedToken = hashToken(token);

    // Find user with matching hashed token that has not expired
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() }, // must still be valid
    });

    if (!user) {
      return res.status(400).json({
        message: 'This password reset link is invalid or has expired. Please request a new one.',
      });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Invalidate the reset token — single-use enforcement
    user.passwordResetToken = null;
    user.passwordResetExpires = null;

    await user.save();

    console.log(`[ResetPassword] Password reset successfully for user ${user._id}`);
    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    console.error('[ResetPassword] Error:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// @desc    Verify reset token validity (used by the mobile app before showing form)
// @route   GET /api/auth/verify-reset-token/:token
// @access  Public
exports.verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ valid: false, message: 'Token is required' });
    }

    const hashedToken = hashToken(token);
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.json({ valid: false, message: 'This link is invalid or has expired.' });
    }

    res.json({ valid: true, email: user.email });
  } catch (error) {
    console.error('[VerifyResetToken] Error:', error);
    res.status(500).json({ valid: false, message: 'Server error' });
  }
};
