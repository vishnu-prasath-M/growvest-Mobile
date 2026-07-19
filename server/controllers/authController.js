const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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

    const userExists = await User.findOne({ $or: [{ username }, { mobileNumber }, { email: email || 'never_match_this_random_string' }] });

    if (userExists) {
      return res.status(400).json({ message: 'User with this username, mobile number or email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      username,
      name,
      mobileNumber,
      email,
      password: hashedPassword,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        username: user.username,
        name: user.name,
        mobileNumber: user.mobileNumber,
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

    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
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
      res.json({
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        mobileNumber: user.mobileNumber,
        role: user.role,
        balance: user.balance
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('GetMe error:', error);
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
    });
  } catch (error) {
    console.error('Update username error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Username already taken' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user profile (username, mobileNumber, name)
// @route   PUT /api/auth/update-profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { username, mobileNumber, name } = req.body;
    const updateFields = {};
    const userId = req.user._id || req.user.id;

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
    });
  } catch (error) {
    console.error('Update profile error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Username or mobile number already in use' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};
