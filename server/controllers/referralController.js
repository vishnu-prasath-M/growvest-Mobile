const User = require('../models/User');
const Referral = require('../models/Referral');
const ReferralLead = require('../models/ReferralLead');
const CoinTransaction = require('../models/CoinTransaction');
const { sendNotification } = require('../services/notificationHelper');

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

// ─── POST /api/referral/track-download (Public) ───────────────────────────────
exports.trackDownloadOrVisit = async (req, res) => {
  try {
    const { referralCode, type, userAgent } = req.body;
    if (!referralCode) {
      return res.status(400).json({ message: 'Referral code is required' });
    }

    const cleanCode = referralCode.toString().trim().toUpperCase();
    const referrer = await User.findOne({ referralCode: cleanCode });

    if (!referrer) {
      return res.status(404).json({ message: 'Referrer not found' });
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const eventType = type === 'LINK_VISIT' ? 'LINK_VISIT' : 'APK_DOWNLOAD';

    // Prevent duplicate lead spam within 10 minutes from the same IP
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const existingRecentLead = await ReferralLead.findOne({
      referrerUserId: referrer._id,
      referralCode: cleanCode,
      type: eventType,
      ipAddress: clientIp,
      createdAt: { $gte: tenMinAgo },
    });

    if (!existingRecentLead) {
      const lead = await ReferralLead.create({
        referrerUserId: referrer._id,
        referralCode: cleanCode,
        type: eventType,
        ipAddress: clientIp,
        userAgent: userAgent || req.headers['user-agent'] || '',
        device: 'Android Mobile',
        status: 'DOWNLOADED',
      });

      // Send real-time in-app / push notification to referrer
      try {
        await sendNotification({
          userId: referrer._id,
          title: eventType === 'APK_DOWNLOAD' ? '📱 Friend Downloaded the App!' : '🔗 Referral Link Visited!',
          description: eventType === 'APK_DOWNLOAD'
            ? 'Someone just downloaded Growvest using your referral link. You will earn Coins once they register!'
            : 'Someone just checked out your Growvest referral invitation link.',
          type: 'referral_lead',
          pushData: { screen: 'Referral' },
        });
      } catch (notifErr) {
        console.warn('[ReferralTrack Notification Warning]', notifErr.message);
      }

      return res.status(201).json({ success: true, message: 'Referral tracked', leadId: lead._id });
    }

    return res.status(200).json({ success: true, message: 'Referral lead active' });
  } catch (error) {
    console.error('Error tracking referral download:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
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

    // 1. Query registered referrals where this user is the referrer
    const referrals = await Referral.find({ referrerUserId: userId })
      .populate('referredUserId', 'username name mobileNumber createdAt')
      .sort({ createdAt: -1 });

    // 2. Also query direct referred users
    const directlyReferredUsers = await User.find({ referredBy: userId }).select('username name mobileNumber createdAt');

    // 3. Query leads (App downloaded via referral link, pending registration)
    const downloadedLeads = await ReferralLead.find({
      referrerUserId: userId,
      status: 'DOWNLOADED',
    }).sort({ createdAt: -1 });

    // Combine unique referred users & downloaded leads
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
        rewardCoins: r.rewardCoins || (['SUCCESSFUL', 'REWARDED'].includes(r.status) ? 100 : 20),
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
          rewardCoins: 20,
          createdAt: u.createdAt,
        });
      }
    }

    // Add downloaded leads to history (showing pending signups)
    for (const lead of downloadedLeads) {
      history.push({
        _id: lead._id,
        displayName: 'Invited Friend (App Downloaded)',
        status: 'DOWNLOADED',
        rewardCoins: 0,
        createdAt: lead.createdAt,
      });
    }

    // Sort combined history by date descending
    history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Query actual referral coins earned from CoinTransaction collection
    const coinTxSum = await CoinTransaction.aggregate([
      { $match: { userId: user._id, type: 'REFERRAL_REWARD' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalCoinsEarned = (coinTxSum[0]?.total) || (history.reduce((sum, h) => sum + (h.rewardCoins || 0), 0));

    const totalInvited = history.length;
    const downloaded = downloadedLeads.length;
    const registered = referrals.length + directlyReferredUsers.filter(u => !referrals.some(r => r.referredUserId?._id?.toString() === u._id.toString())).length;
    const successful = history.filter(r => ['SUCCESSFUL', 'REWARDED'].includes(r.status)).length;
    const pending = totalInvited - successful;

    res.json({
      referralCode: user.referralCode,
      referralLink,
      stats: {
        totalInvited,
        downloaded,
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
