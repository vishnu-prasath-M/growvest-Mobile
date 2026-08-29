const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');

// ─── GET /api/wallet/coins ──────────────────────────────────────────────────
exports.getCoinWallet = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const transactions = await CoinTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);

    const balance = Number(user.coinBalance) || Number(user.coins) || 0;

    res.json({
      coinBalance: balance,
      totalCoins: balance,
      coins: balance,
      transactions,
    });
  } catch (error) {
    console.error('Error fetching coin wallet:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
