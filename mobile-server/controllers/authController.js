const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

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
};
