const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const nodemailer = require('nodemailer');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', {
    expiresIn: '30d',
  });
};

const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const buildPasswordResetHtml = (resetUrl, expiryMinutes = 15) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reset Your Growvest Password</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f0;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td>
              <div style="background:linear-gradient(135deg,#0E3D23 0%,#1A5C39 60%,#2E8B5A 100%);border-radius:16px 16px 0 0;padding:40px 40px 32px;text-align:center;">
                <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;">Growvest</h1>
                <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">Premium Investments</p>
              </div>
            </td>
          </tr>
          <tr>
            <td>
              <div style="background:#ffffff;padding:40px;">
                <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:22px;">Reset Your Password</h2>
                <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
                  We received a request to reset the password for your Growvest account. Click below to proceed.
                </p>
                <div style="text-align:center;margin:32px 0;">
                  <a href="${resetUrl}" style="display:inline-block;background:#0E3D23;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 40px;border-radius:12px;">
                    Reset Password →
                  </a>
                </div>
                <p style="color:#9ca3af;font-size:13px;text-align:center;margin:0 0 24px;">
                  Link: <a href="${resetUrl}">${resetUrl}</a>
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!trimmedEmail) {
      return res.status(400).json({ message: 'Email address is required' });
    }

    const user = await User.findOne({ email: { $regex: new RegExp(`^${trimmedEmail}$`, 'i') } });

    if (!user) {
      return res.status(404).json({ message: 'No account found with this email address.' });
    }

    const plainToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = hashToken(plainToken);
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const webHost = process.env.APP_URL || 'https://growvest-mobile.onrender.com';
    const resetWebUrl = `${webHost}/reset-password?token=${plainToken}`;

    try {
      const transporter = createTransporter();
      await transporter.sendMail({
        from: `"Growvest Security" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: '🔐 Reset Your Growvest Password',
        html: buildPasswordResetHtml(resetWebUrl),
      });
      res.json({ message: 'Password reset link has been sent to your email address.' });
    } catch (emailErr) {
      user.passwordResetToken = null;
      user.passwordResetExpires = null;
      await user.save();
      console.error('[ForgotPassword] Email Error:', emailErr);
      res.status(500).json({ message: 'Failed to send email. Please check server email credentials.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    const hashedToken = hashToken(token);
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'This password reset link is invalid or has expired.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ valid: false, message: 'Token is required' });

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
    console.error(error);
    res.status(500).json({ valid: false, message: 'Server error' });
  }
};

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/mobile/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { username, mobileNumber, email, password } = req.body;

    // Validation
    if (!username || !mobileNumber || !password) {
      return res.status(400).json({ message: 'Please provide username, mobile number, and password' });
    }

    // Check if user exists
    const userExists = await User.findOne({
      $or: [{ username }, { mobileNumber }, { email }]
    });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      username,
      mobileNumber,
      email: email || undefined,
      password: hashedPassword,
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      _id: user._id,
      username: user.username,
      mobileNumber: user.mobileNumber,
      email: user.email,
      balance: user.balance,
      role: user.role,
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Login user
// @route   POST /api/mobile/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { identifier, password, email } = req.body;
    const loginIdentifier = identifier || email;

    // Validation
    if (!loginIdentifier || !password) {
      return res.status(400).json({ message: 'Please provide mobile number/email and password' });
    }

    // Find user by mobile number or email
    const user = await User.findOne({
      $or: [{ mobileNumber: loginIdentifier }, { email: loginIdentifier }]
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      _id: user._id,
      username: user.username,
      name: user.name,
      mobileNumber: user.mobileNumber,
      email: user.email,
      balance: user.balance,
      role: user.role,
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/mobile/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update username
// @route   PUT /api/mobile/auth/username
// @access  Private
const updateUsername = async (req, res) => {
  try {
    const { username } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ message: 'Username is required' });
    }

    // Check if username is taken by another user
    const existingUser = await User.findOne({ 
      username, 
      _id: { $ne: req.user._id } 
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { username: username.trim() },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update mobile number
// @route   PUT /api/mobile/auth/mobile
// @access  Private
const updateMobileNumber = async (req, res) => {
  try {
    const { mobileNumber } = req.body;

    if (!mobileNumber || !mobileNumber.trim()) {
      return res.status(400).json({ message: 'Mobile number is required' });
    }

    // Check if mobile number is taken by another user
    const existingUser = await User.findOne({ 
      mobileNumber, 
      _id: { $ne: req.user._id } 
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Mobile number already taken' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { mobileNumber: mobileNumber.trim() },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update profile (username, mobileNumber, name)
// @route   PUT /api/mobile/auth/update-profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { username, mobileNumber, name } = req.body;
    const updateData = {};

    if (username && username.trim()) {
      // Check if username is taken by another user
      const existingUser = await User.findOne({ 
        username, 
        _id: { $ne: req.user._id } 
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      updateData.username = username.trim();
    }

    if (mobileNumber && mobileNumber.trim()) {
      // Check if mobile number is taken by another user
      const existingUser = await User.findOne({ 
        mobileNumber, 
        _id: { $ne: req.user._id } 
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Mobile number already taken' });
      }
      updateData.mobileNumber = mobileNumber.trim();
    }

    if (name && name.trim()) {
      updateData.name = name.trim();
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updateUsername,
  updateMobileNumber,
  updateProfile,
  forgotPassword,
  resetPassword,
  verifyResetToken,
};
