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

    if (!user) {
      return res.status(404).json({ message: 'User not found. Please sign up.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

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
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
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

    if (!username || !username.trim()) {
      return res.status(400).json({ message: 'Username is required' });
    }

    const existingUser = await User.findOne({ 
      username, 
      _id: { $ne: req.user.id } 
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { username: username.trim() },
      { new: true }
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
      balance: user.balance
    });
  } catch (error) {
    console.error('Update username error:', error);
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

    if (username && username.trim()) {
      // Check if username is taken by another user
      const existingUser = await User.findOne({ 
        username: username.trim(), 
        _id: { $ne: req.user.id } 
      });
      if (existingUser) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      updateFields.username = username.trim();
    }

    if (mobileNumber && mobileNumber.trim()) {
      // Check if mobile number is taken by another user
      const existingMobile = await User.findOne({ 
        mobileNumber: mobileNumber.trim(), 
        _id: { $ne: req.user.id } 
      });
      if (existingMobile) {
        return res.status(400).json({ message: 'Mobile number already in use' });
      }
      updateFields.mobileNumber = mobileNumber.trim();
    }

    if (name && name.trim()) {
      updateFields.name = name.trim();
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateFields,
      { new: true }
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
      balance: user.balance
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
