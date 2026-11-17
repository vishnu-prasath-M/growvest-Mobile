const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');
const Settings = require('../models/Settings');
const Withdrawal = require('../models/Withdrawal');
const { claimDailyLoginReward, getTodayDateStringIST } = require('../utils/referralHelper');
const { sendNotification, notifyAdmins } = require('../services/notificationHelper');

// Helper to get minimum coin withdrawal threshold
const getMinWithdrawalThreshold = async () => {
  try {
    const setting = await Settings.findOne({ key: 'min_reward_withdrawal_coins' });
    if (setting && setting.value) {
      const parsed = parseInt(setting.value, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch (err) {
    console.warn('[Wallet] Error reading min withdrawal setting:', err.message);
  }
  return 1000; // Default: 1000 Coins = ₹50
};

// ─── GET /api/referral/coins OR /api/wallet/coins ───────────────────────────
exports.getCoinWallet = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const minWithdrawalCoins = await getMinWithdrawalThreshold();
    const availableCoins = Number(user.coinBalance) || 0;
    const rupeeValue = Number((availableCoins * 0.05).toFixed(2));
    const minWithdrawalRupees = Number((minWithdrawalCoins * 0.05).toFixed(2));
    const isUnlocked = availableCoins >= minWithdrawalCoins;
    const remainingCoinsToUnlock = Math.max(0, minWithdrawalCoins - availableCoins);
    const progressPercent = Math.min(100, Math.round((availableCoins / minWithdrawalCoins) * 100));

    const todayStr = getTodayDateStringIST();
    const hasClaimedDailyToday = user.lastDailyLoginDate === todayStr;

    // Fetch user's coin transactions
    const transactions = await CoinTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100);

    const totalEarnedCoins = transactions
      .filter(t => t.coins > 0)
      .reduce((sum, t) => sum + (t.coins || 0), 0);

    res.json({
      availableCoins,
      coinBalance: availableCoins,
      totalCoins: availableCoins,
      coins: availableCoins,
      rupeeValue,
      totalEarnedCoins,
      minWithdrawalCoins,
      minWithdrawalRupees,
      isUnlocked,
      remainingCoinsToUnlock,
      progressPercent,
      hasClaimedDailyToday,
      conversionRate: '20 Coins = ₹1 (₹0.05 per Coin)',
      transactions,
    });
  } catch (error) {
    console.error('Error fetching coin wallet:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── POST /api/referral/daily-login ──────────────────────────────────────────
exports.claimDailyLogin = async (req, res) => {
  try {
    const userId = req.user._id;
    const result = await claimDailyLoginReward(userId);

    if (!result.success && result.alreadyClaimed) {
      return res.status(400).json({
        success: false,
        alreadyClaimed: true,
        message: result.message,
      });
    }

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.message || 'Failed to claim daily login reward',
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Error claiming daily login:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─── POST /api/referral/withdraw-coins ───────────────────────────────────────
exports.requestCoinWithdrawal = async (req, res) => {
  try {
    const userId = req.user._id;
    const { upiId, coinsToWithdraw } = req.body;

    if (!upiId || typeof upiId !== 'string' || !/^[a-zA-Z0-9.\-_]{2,100}@[a-zA-Z0-9.\-_]{2,64}$/.test(upiId.trim())) {
      return res.status(400).json({ message: 'Valid UPI ID format is required (e.g. username@okhdfcbank or 9876543210@paytm)' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const availableCoins = Number(user.coinBalance) || 0;
    const minThreshold = await getMinWithdrawalThreshold();

    if (availableCoins < minThreshold) {
      return res.status(400).json({
        message: `Minimum withdrawal threshold is ${minThreshold} Coins (₹${(minThreshold * 0.05).toFixed(2)}). You currently have ${availableCoins} Coins.`,
      });
    }

    const coins = coinsToWithdraw ? parseInt(coinsToWithdraw, 10) : availableCoins;
    if (isNaN(coins) || coins < minThreshold || coins > availableCoins) {
      return res.status(400).json({
        message: `Invalid withdrawal coin amount. Must be between ${minThreshold} and ${availableCoins} Coins.`,
      });
    }

    const rupeeAmount = Number((coins * 0.05).toFixed(2));

    // Deduct coins atomically
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, coinBalance: { $gte: coins } },
      { $inc: { coinBalance: -coins } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(400).json({ message: 'Insufficient coin balance for withdrawal' });
    }

    // Create Coin Transaction for withdrawal
    const coinTx = await CoinTransaction.create({
      userId,
      type: 'COIN_WITHDRAWAL',
      coins: -coins,
      amount: -coins,
      rupeeValue: -rupeeAmount,
      description: `Reward Coins Withdrawal of ${coins} Coins (₹${rupeeAmount}) to ${upiId.trim()}`,
      sourceEvent: 'COIN_WITHDRAWAL_REQUEST',
      status: 'PENDING',
    });

    // Create official Withdrawal record in DB
    const withdrawal = await Withdrawal.create({
      userId,
      userEmail: user.email || `${user.username}@growvest.in`,
      userName: user.name || user.username,
      amount: rupeeAmount,
      upiId: upiId.trim(),
      withdrawType: 'reward',
      status: 'pending',
      date: new Date().toISOString(),
    });

    // Notify User & Admins
    await sendNotification({
      userId,
      title: '🪙 Reward Withdrawal Requested',
      description: `Your withdrawal request of ₹${rupeeAmount} (${coins} Coins) to UPI ID ${upiId.trim()} is submitted and being processed.`,
      type: 'withdrawal_requested',
      metadata: { withdrawalId: withdrawal._id },
    }).catch(err => console.warn('[Notif Error]', err.message));

    await notifyAdmins({
      title: '🪙 New Reward Coins Withdrawal',
      description: `${user.name || user.username} requested a Reward Withdrawal of ₹${rupeeAmount} (${coins} Coins).`,
      type: 'withdrawal_pending',
      metadata: { withdrawalId: withdrawal._id },
    }).catch(err => console.warn('[Admin Notif Error]', err.message));

    res.status(201).json({
      message: `Successfully requested withdrawal of ₹${rupeeAmount} (${coins} Coins)!`,
      withdrawal: {
        _id: withdrawal._id,
        amount: rupeeAmount,
        coinsWithdrawn: coins,
        upiId: withdrawal.upiId,
        status: withdrawal.status,
        remainingCoinBalance: updatedUser.coinBalance,
      },
    });
  } catch (error) {
    console.error('Error requesting coin withdrawal:', error);
    res.status(500).json({ message: 'Server error requesting withdrawal', error: error.message });
  }
};

// ─── ADMIN: Set Minimum Coin Withdrawal Threshold ───────────────────────────
exports.setRewardWithdrawalThreshold = async (req, res) => {
  try {
    const { minCoins } = req.body;
    const parsed = parseInt(minCoins, 10);

    if (isNaN(parsed) || parsed < 20) {
      return res.status(400).json({ message: 'Minimum withdrawal threshold must be at least 20 Coins (₹1.00)' });
    }

    await Settings.findOneAndUpdate(
      { key: 'min_reward_withdrawal_coins' },
      {
        key: 'min_reward_withdrawal_coins',
        value: parsed.toString(),
        description: 'Minimum Coins required for reward withdrawal',
        updatedBy: req.user._id,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({
      message: `Minimum reward withdrawal threshold updated to ${parsed} Coins (₹${(parsed * 0.05).toFixed(2)})`,
      minWithdrawalCoins: parsed,
      minWithdrawalRupees: Number((parsed * 0.05).toFixed(2)),
    });
  } catch (error) {
    console.error('Error setting reward threshold:', error);
    res.status(500).json({ message: 'Server error updating threshold', error: error.message });
  }
};

// ─── GET /api/wallet/overview ────────────────────────────────────────────────
exports.getWalletOverview = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const Transaction = require('../models/Transaction');
    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);

    const cashBalance = Number(user.balance) || 0;
    const coinBalance = Number(user.coinBalance) || 0;
    const coinRupeeValue = Number((coinBalance * 0.05).toFixed(2));

    const todayStr = getTodayDateStringIST();
    const hasClaimedDailyToday = user.lastDailyLoginDate === todayStr;

    return res.status(200).json({
      success: true,
      balance: cashBalance,
      cashBalance,
      coinBalance,
      coinRupeeValue,
      hasClaimedDailyToday,
      transactions,
    });
  } catch (error) {
    console.error('[getWalletOverview] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load wallet overview', error: error.message });
  }
};

// ─── GET /api/wallet/balance ────────────────────────────────────────────────
exports.getWalletBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('balance coinBalance');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({
      success: true,
      balance: Number(user.balance) || 0,
      coinBalance: Number(user.coinBalance) || 0,
    });
  } catch (error) {
    console.error('[getWalletBalance] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch balance', error: error.message });
  }
};

// ─── POST /api/wallet/pay ───────────────────────────────────────────────────
exports.payFromWallet = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount, paymentType, payloadData = {}, title = '' } = req.body;

    const numAmount = Math.round(Number(amount));
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    if (!paymentType) {
      return res.status(400).json({ success: false, message: 'Payment type is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentBalance = Number(user.balance) || 0;
    if (currentBalance < numAmount) {
      return res.status(400).json({
        success: false,
        insufficientBalance: true,
        currentBalance,
        requiredAmount: numAmount,
        deficit: numAmount - currentBalance,
        message: `Insufficient wallet balance. Available: ₹${currentBalance.toLocaleString('en-IN')}, Required: ₹${numAmount.toLocaleString('en-IN')}. Please top up your wallet.`,
      });
    }

    // Atomically deduct balance
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, balance: { $gte: numAmount } },
      { $inc: { balance: -numAmount } },
      { new: true }
    );

    if (!updatedUser) {
      const freshUser = await User.findById(userId);
      const freshBalance = Number(freshUser?.balance) || 0;
      return res.status(400).json({
        success: false,
        insufficientBalance: true,
        currentBalance: freshBalance,
        requiredAmount: numAmount,
        deficit: Math.max(0, numAmount - freshBalance),
        message: 'Insufficient wallet balance for this payment. Please top up your wallet.',
      });
    }

    const orderId = `WAL_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const paymentId = `WAL_PAY_${Date.now()}`;

    // Execute business logic through centralized helper with automatic rollback on error
    const paymentController = require('./paymentController');
    let result = null;
    try {
      result = await paymentController.processSuccessfulOrder(
        orderId,
        paymentId,
        updatedUser,
        paymentType,
        payloadData
      );
    } catch (execErr) {
      console.error('[payFromWallet] Process error, rolling back balance:', execErr);
      await User.findByIdAndUpdate(userId, { $inc: { balance: numAmount } });
      return res.status(500).json({
        success: false,
        message: execErr.message || 'Failed to complete order. Your wallet balance has been refunded.',
      });
    }

    // Send in-app notification
    try {
      await sendNotification({
        userId,
        title: 'Wallet Payment Successful! ⚡',
        description: `₹${numAmount.toLocaleString('en-IN')} debited from wallet for ${title || paymentType}. New balance: ₹${updatedUser.balance.toLocaleString('en-IN')}.`,
        type: 'wallet_payment',
        metadata: { amount: numAmount, paymentType, orderId },
      });
    } catch (notifErr) {
      console.warn('[payFromWallet] Notification skipped:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Payment completed successfully from wallet!',
      balance: updatedUser.balance,
      orderId,
      data: result?.data,
    });
  } catch (error) {
    console.error('[payFromWallet] Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to process payment from wallet', error: error.message });
  }
};
