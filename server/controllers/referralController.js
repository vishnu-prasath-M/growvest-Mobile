const User = require('../models/User');
const Referral = require('../models/Referral');
const CoinTransaction = require('../models/CoinTransaction');

// Helper to generate a unique 6-char uppercase referral code
const generateUniqueReferralCode = async () => {
  let code = '';
  let exists = true;
  while (exists) {
    code = 'GV' + Math.random().toString(36).substring(2, 6).toUpperCase();
    const count = await User.countDocuments({ referralCode: code });
    if (count === 0) exists = false;
  }
  return code;
};

// ─── GET /api/referral/info ──────────────────────────────────────────────────
exports.getReferralInfo = async (req, res) => {
  try {
    const userId = req.user._id;
    let user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ensure user has a referral code
    if (!user.referralCode) {
      const code = await generateUniqueReferralCode();
      user.referralCode = code;
      await user.save();
    }

    const appDomain = process.env.APP_URL || 'https://growvest-mobile.onrender.com';
    const referralLink = `${appDomain}/ref/${user.referralCode}`;

    // Query referrals where this user is the referrer
    const referrals = await Referral.find({ referrerUserId: userId })
      .populate('referredUserId', 'username name mobileNumber createdAt')
      .sort({ createdAt: -1 });

    // Also query direct referred users
    const directlyReferredUsers = await User.find({ referredBy: userId }).select('username name mobileNumber createdAt');

    // Combine unique referred users
    const seenUserIds = new Set();
    const history = [];

    for (const r of referrals) {
      const refUser = r.referredUserId;
      if (refUser && refUser._id) {
        seenUserIds.add(refUser._id.toString());
      }
      let displayName = 'Referred Friend';
      if (refUser) {
        const name = refUser.name || refUser.username || 'Friend';
        displayName = name.length > 4 ? `${name.substring(0, 3)}***` : `${name}***`;
      }
      history.push({
        _id: r._id,
        displayName,
        status: r.status || 'REGISTERED',
        rewardCoins: r.rewardCoins || (['SUCCESSFUL', 'REWARDED'].includes(r.status) ? 100 : 50),
        createdAt: r.createdAt,
      });
    }

    for (const u of directlyReferredUsers) {
      if (!seenUserIds.has(u._id.toString())) {
        seenUserIds.add(u._id.toString());
        const name = u.name || u.username || 'Friend';
        const displayName = name.length > 4 ? `${name.substring(0, 3)}***` : `${name}***`;
        history.push({
          _id: u._id,
          displayName,
          status: 'REGISTERED',
          rewardCoins: 50,
          createdAt: u.createdAt,
        });
      }
    }

    // Query actual referral coins earned from CoinTransaction collection
    const coinTxSum = await CoinTransaction.aggregate([
      { $match: { userId: user._id, type: 'REFERRAL_REWARD' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalCoinsEarned = (coinTxSum[0]?.total) || (history.reduce((sum, h) => sum + (h.rewardCoins || 0), 0));

    const totalInvited = history.length;
    const successful = history.filter(r => ['SUCCESSFUL', 'REWARDED'].includes(r.status)).length;
    const registered = totalInvited;
    const pending = totalInvited - successful;

    res.json({
      referralCode: user.referralCode,
      referralLink,
      stats: {
        totalInvited,
        registered,
        successful,
        pending,
        totalCoinsEarned,
      },
      history,
    });
  } catch (error) {
    console.error('Error fetching referral info:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
