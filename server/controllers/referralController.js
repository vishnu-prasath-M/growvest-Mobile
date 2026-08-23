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

    const totalInvited = referrals.length;
    const registered = referrals.filter(r => ['REGISTERED', 'PENDING'].includes(r.status)).length;
    const successful = referrals.filter(r => ['SUCCESSFUL', 'REWARDED'].includes(r.status)).length;
    const pending = registered;
    const totalCoinsEarned = referrals
      .filter(r => ['SUCCESSFUL', 'REWARDED'].includes(r.status))
      .reduce((sum, r) => sum + (r.rewardCoins || 100), 0);

    const history = referrals.map(r => {
      const refUser = r.referredUserId;
      let displayName = 'Referred User';
      if (refUser) {
        const name = refUser.username || refUser.name || 'User';
        displayName = name.length > 4 ? `${name.substring(0, 3)}***` : `${name}***`;
      }
      return {
        _id: r._id,
        displayName,
        status: r.status,
        rewardCoins: ['SUCCESSFUL', 'REWARDED'].includes(r.status) ? (r.rewardCoins || 100) : 0,
        createdAt: r.createdAt,
      };
    });

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
