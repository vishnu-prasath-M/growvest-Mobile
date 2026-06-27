const User = require('../models/User');
const Investment = require('../models/Investment');
const Withdrawal = require('../models/Withdrawal');

// Helper function to calculate daily interest for an investment
// Formula: (currentBalance * rate%) / 365 * daysSinceStart
// Uses full precision (no rounding) so paisa-level values are preserved
// Helper function to sync interest for an investment (Feature 3 & 4)
// strictly calculates ONLY after midnight and once per day
const syncInvestmentInterest = async (inv) => {
  const startDate = new Date(inv.startDate);
  startDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Feature 4: Reset Wrong Interest Data (Version 3)
  if (inv.interestLogicVersion !== 3) {
    await Investment.updateOne({ _id: inv._id }, { $set: { interestEarned: 0, interestLogicVersion: 3, lastInterestCalculatedAt: startDate } });
    inv.interestEarned = 0;
    inv.interestLogicVersion = 3;
    inv.lastInterestCalculatedAt = startDate;
  }

  const lastCalcAt = inv.lastInterestCalculatedAt ? new Date(inv.lastInterestCalculatedAt) : startDate;
  lastCalcAt.setHours(0, 0, 0, 0);

  // Interest starts calculating ONLY AFTER midnight the next day
  // If today is Tuesday and lastCalcAt was Monday (0,0,0,0), diffDays = 1.
  if (today > lastCalcAt) {
    const diffTime = today - lastCalcAt;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
      const rate = inv.type === 'fixed' ? 24 : 12;
      // Daily Interest = (Amount * Rate) / 100 / 365
      const dailyInterest = (inv.amount * rate) / 100 / 365;
      
      await Investment.updateOne({ _id: inv._id }, { $set: { interestEarned: inv.interestEarned + (dailyInterest * diffDays), lastInterestCalculatedAt: today } });
      inv.interestEarned = (inv.interestEarned || 0) + (dailyInterest * diffDays);
      inv.lastInterestCalculatedAt = today;
    }
  }
  return inv.interestEarned || 0;
};

// Helper to get enriched user data by any query (email or ID)
const getEnrichedUserData = async (query) => {
  const user = await User.findOne(query);
  if (!user) return null;

  const email = user.email;
  const mobileNumber = user.mobileNumber;

  // Build $or conditions dynamically (only include non-empty values)
  const investmentOrConditions = [];
  if (email) investmentOrConditions.push({ userEmail: email });
  if (mobileNumber) investmentOrConditions.push({ mobileNumber: mobileNumber });
  const investmentQuery = investmentOrConditions.length > 0
    ? { $or: investmentOrConditions, status: 'approved' }
    : { status: 'approved', userEmail: '__no_match__' };

  // Get all approved investments by email OR mobile number
  const investments = await Investment.find(investmentQuery);

  // Run Sync Logic for each investment
  for (const inv of investments) {
    await syncInvestmentInterest(inv);
  }

  const withdrawalOrConditions = [];
  if (email) withdrawalOrConditions.push({ userEmail: email });
  if (mobileNumber) withdrawalOrConditions.push({ mobileNumber: mobileNumber });
  const withdrawalQuery = withdrawalOrConditions.length > 0
    ? { $or: withdrawalOrConditions, status: { $in: ['paid', 'approved'] } }
    : { status: { $in: ['paid', 'approved'] }, userEmail: '__no_match__' };

  // Get all paid withdrawals by email OR mobile number
  const withdrawals = await Withdrawal.find(withdrawalQuery);

  // Separate by type
  const savingInvestments = investments.filter(inv => inv.type === 'saving');
  const fixedInvestments = investments.filter(inv => inv.type === 'fixed');

  const savingWithdrawals = withdrawals.filter(wd => wd.withdrawType === 'saving');
  const fixedWithdrawals = withdrawals.filter(wd => wd.withdrawType === 'fixed');

  // Calculate totals for SAVING
  const savingInvested = savingInvestments.reduce((acc, inv) => acc + inv.amount, 0);
  const savingInterest = savingInvestments.reduce((acc, inv) => acc + (inv.interestEarned || 0), 0);
  const savingWithdrawn = savingWithdrawals.reduce((acc, wd) => acc + wd.amount, 0);
  let savingBalance = savingInvested + savingInterest - savingWithdrawn;
  if (savingBalance < 0) savingBalance = 0;

  // Calculate totals for FIXED
  const fixedInvested = fixedInvestments.reduce((acc, inv) => acc + inv.amount, 0);
  const fixedInterest = fixedInvestments.reduce((acc, inv) => acc + (inv.interestEarned || 0), 0);
  const fixedWithdrawn = fixedWithdrawals.reduce((acc, wd) => acc + wd.amount, 0);
  let fixedBalance = fixedInvested + fixedInterest - fixedWithdrawn;
  if (fixedBalance < 0) fixedBalance = 0;

  const availableFixed = fixedInvestments.filter(inv => {
    const diffDays = (new Date() - new Date(inv.startDate)) / (1000 * 60 * 60 * 24);
    return diffDays >= 365;
  }).reduce((acc, inv) => acc + inv.amount + (inv.interestEarned || 0), 0);

  const availableToWithdraw = savingBalance + availableFixed;

  // Total balance - use user.balance if available, otherwise calculate from investments
  let totalBalance = user.balance !== undefined ? user.balance : (savingBalance + fixedBalance);
  if (totalBalance < 0) totalBalance = 0;

  // Total calculations
  const totalInvested = savingInvested + fixedInvested;
  const totalInterest = savingInterest + fixedInterest;
  const totalWithdrawn = savingWithdrawn + fixedWithdrawn;

  return {
    ...user.toObject(),
    balance: totalBalance,
    totalBalance,
    savingBalance,
    fixedBalance,
    availableToWithdraw,
    totalInvested,
    totalInterest,
    totalWithdrawn,
    saving: {
      invested: savingInvested,
      interest: savingInterest,
      withdrawn: savingWithdrawn,
      balance: savingBalance
    },
    fixed: {
      invested: fixedInvested,
      interest: fixedInterest,
      withdrawn: fixedWithdrawn,
      balance: fixedBalance
    }
  };
};

// Get user profile (using token)
exports.getUserProfile = async (req, res) => {
  try {
    const data = await getEnrichedUserData({ _id: req.user.id });
    if (!data) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile', error: error.message });
  }
};

// Get user balances – CORRECT DAILY CALCULATION
exports.getUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    // Check by email OR mobile number
    const data = await getEnrichedUserData({ 
      $or: [
        { email: email },
        { mobileNumber: email }
      ]
    });
    if (!data) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user', error: error.message });
  }
};

// Get detailed user data for admin dropdown
exports.getUserDetailByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    // Look up by email OR mobileNumber for old/new user compatibility
    const user = await User.findOne({ $or: [{ email }, { mobileNumber: email }] }).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const investOrConds = [];
    if (user.email) investOrConds.push({ userEmail: user.email });
    if (user.mobileNumber) investOrConds.push({ mobileNumber: user.mobileNumber });
    const invQuery = investOrConds.length > 0
      ? { $or: investOrConds, status: 'approved' }
      : { status: 'approved', userEmail: '__no_match__' };

    const investments = await Investment.find(invQuery);
    
    // Sync each before detail view
    for (const inv of investments) {
      await syncInvestmentInterest(inv);
    }

    const wdOrConditions = [];
    if (user.email) wdOrConditions.push({ userEmail: user.email });
    if (user.mobileNumber) wdOrConditions.push({ mobileNumber: user.mobileNumber });
    const wdQuery = wdOrConditions.length > 0
      ? { $or: wdOrConditions, status: { $in: ['paid', 'approved'] } }
      : { status: { $in: ['paid', 'approved'] }, userEmail: '__no_match__' };

    const withdrawals = await Withdrawal.find(wdQuery);

    const savingInvestments = investments.filter(inv => inv.type === 'saving');
    const fixedInvestments = investments.filter(inv => inv.type === 'fixed');
    const savingWithdrawals = withdrawals.filter(wd => wd.withdrawType === 'saving');
    const fixedWithdrawals = withdrawals.filter(wd => wd.withdrawType === 'fixed');

    const savingInvested = savingInvestments.reduce((acc, inv) => acc + inv.amount, 0);
    const savingInterest = savingInvestments.reduce((acc, inv) => acc + (inv.interestEarned || 0), 0);
    const savingWithdrawn = savingWithdrawals.reduce((acc, wd) => acc + wd.amount, 0);
    const savingBalance = Math.max(0, savingInvested + savingInterest - savingWithdrawn);

    const fixedInvested = fixedInvestments.reduce((acc, inv) => acc + inv.amount, 0);
    const fixedInterest = fixedInvestments.reduce((acc, inv) => acc + (inv.interestEarned || 0), 0);
    const fixedWithdrawn = fixedWithdrawals.reduce((acc, wd) => acc + wd.amount, 0);
    const fixedBalance = Math.max(0, fixedInvested + fixedInterest - fixedWithdrawn);

    const totalInvested = savingInvested + fixedInvested;
    const totalInterest = savingInterest + fixedInterest;
    const totalBalance = savingBalance + fixedBalance;

    const withdrawableFixed = fixedInvestments.filter(inv => {
      const diffDays = (new Date() - new Date(inv.startDate)) / (1000 * 60 * 60 * 24);
      return diffDays >= 365;
    }).reduce((acc, inv) => acc + inv.amount + (inv.interestEarned || 0), 0);
    
    const availableToWithdrawDetail = savingBalance + withdrawableFixed;

    res.status(200).json({
      user,
      totalInvested,
      totalEarnings: totalInterest,
      currentBalance: totalBalance,
      availableToWithdraw: availableToWithdrawDetail,
      saving: {
        invested: savingInvested,
        interest: savingInterest,
        withdrawn: savingWithdrawn,
        balance: savingBalance,
        count: savingInvestments.length
      },
      fixed: {
        invested: fixedInvested,
        interest: fixedInterest,
        withdrawn: fixedWithdrawn,
        balance: fixedBalance,
        count: fixedInvestments.length
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user detail', error: error.message });
  }
};

// Admin: Get total payable balance across all users
exports.getTotalPayableBalance = async (req, res) => {
  try {
    const investments = await Investment.find({ status: 'approved' });
    const withdrawals = await Withdrawal.find({ status: { $in: ['paid', 'approved'] } });

    let totalPayable = 0;
    const emails = [...new Set(investments.map(inv => inv.userEmail))];

    for (const email of emails) {
      const userInvestments = investments.filter(inv => inv.userEmail === email);
      const userWithdrawals = withdrawals.filter(wd => wd.userEmail === email);

      // Sync user investments even for admin view
      let userInterest = 0;
      for (const inv of userInvestments) {
        userInterest += await syncInvestmentInterest(inv);
      }

      const totalInvested = userInvestments.reduce((acc, inv) => acc + inv.amount, 0);
      const totalWithdrawn = userWithdrawals.reduce((acc, wd) => acc + wd.amount, 0);

      const userBalance = Math.max(0, totalInvested + userInterest - totalWithdrawn);
      totalPayable += userBalance;
    }

    res.status(200).json({ totalPayableBalance: totalPayable });
  } catch (error) {
    res.status(500).json({ message: 'Error calculating total payable balance', error: error.message });
  }
};

// Update user balance
exports.updateBalance = async (req, res) => {
  try {
    const { email } = req.params;
    const { balance } = req.body;
    const user = await User.findOneAndUpdate({ email }, { balance }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error updating balance', error: error.message });
  }
};

// Get all users (for admin) with accurate balances and earnings
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    
    // Enrich users with current stats
    const enrichedUsers = await Promise.all(users.map(async (user) => {
      if (user.role === 'admin') return user.toObject();

      const allUserInvOrConds = [];
      if (user.email) allUserInvOrConds.push({ userEmail: user.email });
      if (user.mobileNumber) allUserInvOrConds.push({ mobileNumber: user.mobileNumber });
      const allUserInvQuery = allUserInvOrConds.length > 0
        ? { $or: allUserInvOrConds, status: 'approved' }
        : { status: 'approved', userEmail: '__no_match__' };

      const investments = await Investment.find(allUserInvQuery);
      
      let totalInterest = 0;
      for (const inv of investments) {
        totalInterest += await syncInvestmentInterest(inv);
      }
      
      const allUserWdOrConditions = [];
      if (user.email) allUserWdOrConditions.push({ userEmail: user.email });
      if (user.mobileNumber) allUserWdOrConditions.push({ mobileNumber: user.mobileNumber });
      const allUserWdQuery = allUserWdOrConditions.length > 0
        ? { $or: allUserWdOrConditions, status: { $in: ['paid', 'approved'] } }
        : { status: { $in: ['paid', 'approved'] }, userEmail: '__no_match__' };

      const withdrawals = await Withdrawal.find(allUserWdQuery);
      
      const totalInvested = investments.reduce((acc, inv) => acc + inv.amount, 0);
      const totalWithdrawn = withdrawals.reduce((acc, wd) => acc + wd.amount, 0);
      
      const currentBalance = Math.max(0, totalInvested + totalInterest - totalWithdrawn);
      
      // Update balance if changed
      if (user.balance !== currentBalance) {
        await User.updateOne({ _id: user._id }, { $set: { balance: currentBalance } });
        user.balance = currentBalance; // update the local object for response
      }

      return {
        ...user.toObject(),
        totalInvested,
        totalEarnings: totalInterest,
        currentBalance
      };
    }));

    res.status(200).json(enrichedUsers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

exports.syncInvestmentInterest = syncInvestmentInterest;

// @desc    Save or update FCM token for push notifications
// @route   PUT /api/users/fcm-token
// @access  Private
exports.saveFcmToken = async (req, res) => {
  try {
    const { fcmToken, platform = 'android', deviceId } = req.body;

    if (!fcmToken || typeof fcmToken !== 'string') {
      return res.status(400).json({ message: 'FCM token is required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const now = new Date();
    const normalizedPlatform = ['android', 'ios', 'web'].includes(platform) ? platform : 'android';
    const tokens = Array.isArray(user.fcmTokens) ? [...user.fcmTokens] : [];

    const existingIndex = tokens.findIndex((entry) => {
      if (entry.token === fcmToken) {
        return true;
      }
      return deviceId && entry.deviceId && entry.deviceId === deviceId;
    });

    const tokenEntry = {
      token: fcmToken.trim(),
      platform: normalizedPlatform,
      deviceId: deviceId || null,
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      tokens[existingIndex] = tokenEntry;
    } else {
      tokens.push(tokenEntry);
    }

    const dedupedTokens = [];
    const seen = new Set();
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      const key = tokens[i].token;
      if (!seen.has(key)) {
        seen.add(key);
        dedupedTokens.unshift(tokens[i]);
      }
    }

    user.fcmTokens = dedupedTokens.slice(-10);
    await user.save();

    res.status(200).json({
      message: 'FCM token saved',
      tokenCount: user.fcmTokens.length,
    });
  } catch (error) {
    console.error('Save FCM token error:', error);
    res.status(500).json({ message: 'Error saving FCM token', error: error.message });
  }
};

// @desc    Remove FCM token on logout or device unregister
// @route   DELETE /api/users/fcm-token
// @access  Private
exports.removeFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ message: 'FCM token is required' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { fcmTokens: { token: fcmToken } } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'FCM token removed' });
  } catch (error) {
    console.error('Remove FCM token error:', error);
    res.status(500).json({ message: 'Error removing FCM token', error: error.message });
  }
};
