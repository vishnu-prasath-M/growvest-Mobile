const User = require('../models/User');
const Investment = require('../models/Investment');
const Withdrawal = require('../models/Withdrawal');
const DeviceToken = require('../models/DeviceToken');

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

  // If this is a duration-based plan, calculate elapsed interest dynamically
  if (inv.durationDays && inv.dailyInterest) {
    const totalElapsedDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.max(0, Math.min(inv.durationDays, totalElapsedDays));
    const interestEarned = elapsedDays * inv.dailyInterest;
    
    // Save to DB
    await Investment.updateOne(
      { _id: inv._id },
      { $set: { interestEarned, lastInterestCalculatedAt: today } }
    );
    inv.interestEarned = interestEarned;
    inv.lastInterestCalculatedAt = today;
    return interestEarned;
  }

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

const { getUserPortfolioSummary } = require('../utils/portfolioHelper');

// Helper to get enriched user data by any query (email or ID)
const getEnrichedUserData = async (query) => {
  const user = await User.findOne(query);
  if (!user) return null;

  const summary = await getUserPortfolioSummary(user._id);
  if (!summary) return user.toObject();

  return {
    ...user.toObject(),
    balance: summary.balances.totalBalance,
    totalBalance: summary.balances.totalBalance,
    savingBalance: summary.balances.availableToWithdraw,
    fixedBalance: 0,
    availableToWithdraw: summary.balances.availableToWithdraw,
    totalChitWinningAmount: summary.balances.totalChitWinningAmount,
    winningAmount: summary.balances.totalChitWinningAmount,
    totalInvested: summary.balances.totalInvested,
    totalLocked: summary.balances.totalLocked,
    dailyInterest: summary.balances.dailyInterest,
    totalInterestEarned: summary.balances.totalInterestEarned,
    totalInterest: summary.balances.totalInterestEarned,
    totalWithdrawn: 0,
    saving: {
      invested: summary.balances.totalInvested,
      interest: summary.balances.totalInterestEarned,
      withdrawn: 0,
      balance: summary.balances.availableToWithdraw
    },
    fixed: {
      invested: 0,
      interest: 0,
      withdrawn: 0,
      balance: 0
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
    const userOrConditions = [{ userId: user._id }];
    if (user._id) userOrConditions.push({ userId: user._id.toString() });
    if (user.email && typeof user.email === 'string' && user.email.trim() !== '' && !user.email.includes('no-email@') && user.email !== 'undefined') {
      userOrConditions.push({ userEmail: new RegExp(`^${user.email.trim()}$`, 'i') });
    }
    if (user.mobileNumber && typeof user.mobileNumber === 'string' && user.mobileNumber.trim() !== '' && user.mobileNumber.trim() !== '0000000000' && user.mobileNumber.trim() !== '1234567890' && user.mobileNumber !== 'undefined') {
      userOrConditions.push({ mobileNumber: user.mobileNumber.trim() });
    }

    const investments = await Investment.find({ $or: userOrConditions });
    
    // Sync each before detail view
    for (const inv of investments) {
      await syncInvestmentInterest(inv);
    }

    const withdrawals = await Withdrawal.find({ $or: userOrConditions, status: { $in: ['paid', 'approved'] } });

    const KYC = require('../models/KYC');
    const kyc = await KYC.findOne({ userId: user._id });
    const upiId = kyc ? kyc.upiId : '';

    const PocketMoney = require('../models/PocketMoney');
    const pocketMonies = await PocketMoney.find({ userId: user._id });
    const pocketInvested = pocketMonies.reduce((acc, pm) => acc + pm.investedAmount, 0);
    const pocketReleased = pocketMonies.reduce((acc, pm) => acc + pm.totalPaidOut, 0);
    const pocketRemaining = pocketMonies.reduce((acc, pm) => acc + pm.remainingAmount, 0);

    const savingInvestments = investments.filter(inv => inv.type === 'saving');
    const fixedInvestments = investments.filter(inv => inv.type === 'fixed');
    
    // Dynamic duration-based investment categories
    const durationPlanTypes = ['15_days', '1_month', '3_months', '6_months', '1_year'];
    const durationInvestments = investments.filter(inv => durationPlanTypes.includes(inv.type));
    
    // Separate into Matured vs Locked
    const maturedInvestments = durationInvestments.filter(inv => {
      return new Date() >= new Date(inv.maturityDate);
    });
    const lockedInvestments = durationInvestments.filter(inv => {
      return new Date() < new Date(inv.maturityDate);
    });

    const savingWithdrawals = withdrawals.filter(wd => wd.withdrawType === 'saving');
    const fixedWithdrawals = withdrawals.filter(wd => wd.withdrawType === 'fixed');

    const savingInvested = savingInvestments.reduce((acc, inv) => acc + inv.amount, 0);
    const savingInterest = savingInvestments.reduce((acc, inv) => acc + (inv.interestEarned || 0), 0);
    
    // Matured principal + interest added directly to withdrawable savings pool
    const maturedPrincipal = maturedInvestments.reduce((acc, inv) => acc + inv.amount, 0);
    const maturedInterest = maturedInvestments.reduce((acc, inv) => acc + (inv.interestEarned || 0), 0);
    const maturedTotal = maturedPrincipal + maturedInterest;

    const savingWithdrawn = savingWithdrawals.reduce((acc, wd) => acc + wd.amount, 0);
    const savingBalance = Math.max(0, savingInvested + savingInterest + pocketReleased + maturedTotal - savingWithdrawn);

    const fixedInvested = fixedInvestments.reduce((acc, inv) => acc + inv.amount, 0);
    const fixedInterest = fixedInvestments.reduce((acc, inv) => acc + (inv.interestEarned || 0), 0);
    const fixedWithdrawn = fixedWithdrawals.reduce((acc, wd) => acc + wd.amount, 0);
    const fixedBalance = Math.max(0, fixedInvested + fixedInterest - fixedWithdrawn);

    // Locked duration plans
    const lockedDurationPrincipal = lockedInvestments.reduce((acc, inv) => acc + inv.amount, 0);
    const lockedDurationInterest = lockedInvestments.reduce((acc, inv) => acc + (inv.interestEarned || 0), 0);
    const lockedDurationTotal = lockedDurationPrincipal + lockedDurationInterest;

    const durationInvested = durationInvestments.reduce((acc, inv) => acc + inv.amount, 0);
    const durationInterest = durationInvestments.reduce((acc, inv) => acc + (inv.interestEarned || 0), 0);

    const totalInvested = savingInvested + fixedInvested + pocketInvested + durationInvested;
    const totalInterest = savingInterest + fixedInterest + durationInterest;
    const totalBalance = savingBalance + fixedBalance + lockedDurationTotal;

    const withdrawableFixed = fixedInvestments.filter(inv => {
      const diffDays = (new Date() - new Date(inv.startDate)) / (1000 * 60 * 60 * 24);
      return diffDays >= 365;
    }).reduce((acc, inv) => acc + inv.amount + (inv.interestEarned || 0), 0);
    
    const availableToWithdrawDetail = savingBalance + withdrawableFixed;

    res.status(200).json({
      user,
      upiId,
      totalInvested,
      totalEarnings: totalInterest,
      currentBalance: totalBalance,
      availableToWithdraw: availableToWithdrawDetail,
      saving: {
        invested: savingInvested + maturedPrincipal,
        interest: savingInterest + maturedInterest,
        withdrawn: savingWithdrawn,
        balance: savingBalance,
        count: savingInvestments.length + maturedInvestments.length
      },
      fixed: {
        invested: fixedInvested,
        interest: fixedInterest,
        withdrawn: fixedWithdrawn,
        balance: fixedBalance,
        count: fixedInvestments.length
      },
      pocketMoney: {
        invested: pocketInvested,
        released: pocketReleased,
        remaining: pocketRemaining,
        count: pocketMonies.length
      },
      durationInvestments: {
        invested: durationInvested,
        interest: durationInterest,
        lockedAmount: lockedDurationTotal,
        maturedAmount: maturedTotal,
        count: durationInvestments.length
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

      const investments = await Investment.find({ userId: user._id });
      
      let totalInterest = 0;
      for (const inv of investments) {
        totalInterest += await syncInvestmentInterest(inv);
      }
      
      const withdrawals = await Withdrawal.find({ userId: user._id, status: { $in: ['paid', 'approved'] } });
      
      const PocketMoneyPayout = require('../models/PocketMoneyPayout');
      const pocketPayouts = await PocketMoneyPayout.find({ userId: user._id });
      const totalPocketReleased = pocketPayouts.reduce((acc, p) => acc + p.amount, 0);

      const totalInvested = investments.reduce((acc, inv) => acc + inv.amount, 0);
      const totalWithdrawn = withdrawals.reduce((acc, wd) => acc + wd.amount, 0);
      
      const currentBalance = Math.max(0, totalInvested + totalInterest + totalPocketReleased - totalWithdrawn);
      
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

    const finalTokens = dedupedTokens.slice(-10);
    await User.findByIdAndUpdate(user._id, { fcmTokens: finalTokens });

    res.status(200).json({
      message: 'FCM token saved',
      tokenCount: finalTokens.length,
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

// @desc    Register device for push notifications
// @route   POST /api/users/register-device
// @access  Private
exports.registerDevice = async (req, res) => {
  try {
    const { userId, username, deviceToken, platform, isStandalone } = req.body;

    if (!userId || !deviceToken) {
      return res.status(400).json({ message: 'userId and deviceToken are required' });
    }

    const cleanToken = deviceToken.trim();
    const normalizedPlatform = ['android', 'ios', 'web'].includes(platform) ? platform : 'android';
    const deviceType = isStandalone ? 'standalone_apk' : 'expo_go';

    // REQUIREMENT H: Disassociate this token from ALL OTHER users so User A's token
    // is never attached to User B when switching accounts on the same physical device.
    await User.updateMany(
      { _id: { $ne: userId } },
      { $pull: { fcmTokens: { token: cleanToken } } }
    );

    // Save to legacy DeviceToken collection if needed
    try {
      const existingToken = await DeviceToken.findOne({ deviceToken: cleanToken });
      if (existingToken) {
        await DeviceToken.findByIdAndUpdate(
          existingToken._id,
          { userId, username: username || 'user', platform: normalizedPlatform, updatedAt: Date.now() }
        );
      } else {
        await DeviceToken.create({
          userId,
          username: username || 'user',
          deviceToken: cleanToken,
          platform: normalizedPlatform
        });
      }
    } catch (legacyErr) {
      console.warn('[RegisterDevice] Legacy collection update warning:', legacyErr.message);
    }

    // Save/update token in User.fcmTokens
    const user = await User.findById(userId);
    if (user) {
      const now = new Date();
      let tokens = Array.isArray(user.fcmTokens) ? [...user.fcmTokens] : [];

      const tokenEntry = {
        token: cleanToken,
        platform: normalizedPlatform,
        deviceId: deviceType,
        updatedAt: now,
      };

      // Check if token already registered for this user
      const existingIndex = tokens.findIndex((entry) => entry.token === cleanToken);
      if (existingIndex >= 0) {
        tokens[existingIndex] = tokenEntry;
      } else {
        tokens.push(tokenEntry);
      }

      // Deduplicate keeping newest entries (max 10 tokens per user)
      const dedupedTokens = [];
      const seen = new Set();
      for (let i = tokens.length - 1; i >= 0; i -= 1) {
        const key = tokens[i].token;
        if (!seen.has(key)) {
          seen.add(key);
          dedupedTokens.unshift(tokens[i]);
        }
      }

      await User.findByIdAndUpdate(userId, { fcmTokens: dedupedTokens.slice(-10) });
      console.log(`[PushNotification] Device token registered for user ${userId} (${deviceType})`);
    }

    res.status(200).json({ message: 'Device registered successfully' });
  } catch (error) {
    console.error('Register device error:', error);
    res.status(500).json({ message: 'Error registering device', error: error.message });
  }
};

// @route   POST /api/users/unregister-device
// @access  Private
exports.unregisterDevice = async (req, res) => {
  try {
    const { deviceToken } = req.body;
    const userId = req.user._id;

    if (deviceToken) {
      const cleanToken = deviceToken.trim();
      await User.findByIdAndUpdate(userId, {
        $pull: { fcmTokens: { token: cleanToken } }
      });
      await DeviceToken.deleteMany({ deviceToken: cleanToken, userId });
      console.log(`[PushNotification] Token unregistered for logging-out user ${userId}`);
    }

    res.status(200).json({ message: 'Device unregistered successfully' });
  } catch (error) {
    console.error('Unregister device error:', error);
    res.status(500).json({ message: 'Error unregistering device', error: error.message });
  }
};

exports.getEnrichedUserData = getEnrichedUserData;
