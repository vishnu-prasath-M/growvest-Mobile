const APKRelease = require('../models/APKRelease');
const Referral = require('../models/Referral');
const User = require('../models/User');
const Investment = require('../models/Investment');
const ChitMember = require('../models/ChitMember');
const PocketMoney = require('../models/PocketMoney');
const fs = require('fs');
const path = require('path');

// ─── ADMIN: Upload APK ───────────────────────────────────────────────────────
exports.uploadAPK = async (req, res) => {
  try {
    const adminId = req.user._id || req.user.id;
    const { fileName, base64Data, version } = req.body;

    if (!fileName || (!base64Data && !req.file)) {
      return res.status(400).json({ message: 'APK file data is required' });
    }

    // Validate extension
    const name = fileName || req.file?.originalname || 'growvest.apk';
    if (!name.toLowerCase().endsWith('.apk')) {
      return res.status(400).json({ message: 'Invalid file format. Only .apk files are allowed.' });
    }

    let fileSize = 0;
    let apkData = '';

    if (base64Data) {
      apkData = base64Data.replace(/^data:application\/[a-z\-]+;base64,/, '').replace(/\s/g, '');
      const buffer = Buffer.from(apkData, 'base64');
      fileSize = buffer.length;
    } else if (req.file) {
      fileSize = req.file.size;
      apkData = req.file.buffer.toString('base64');
    }

    if (fileSize < 100) {
      return res.status(400).json({ message: 'Invalid APK file content or empty file' });
    }

    // Save physical file as secondary storage if directory writable
    const downloadsDir = path.join(__dirname, '../public/downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }
    const physicalPath = path.join(downloadsDir, 'growvest-latest.apk');
    try {
      fs.writeFileSync(physicalPath, Buffer.from(apkData, 'base64'));
    } catch (fsErr) {
      console.warn('[APK Upload] Could not write to physical disk (using DB storage):', fsErr.message);
    }

    // Mark all existing active APKs as inactive
    await APKRelease.updateMany({ status: 'active' }, { status: 'inactive' });

    // Create new active APK release
    const newAPK = await APKRelease.create({
      fileName: name,
      fileSize,
      apkData,
      storagePath: '/downloads/growvest-latest.apk',
      version: version || '1.0.0',
      uploadedBy: adminId,
      status: 'active',
      downloadCount: 0,
    });

    res.status(201).json({
      message: 'APK uploaded successfully and marked as Active',
      apk: {
        _id: newAPK._id,
        fileName: newAPK.fileName,
        fileSize: newAPK.fileSize,
        version: newAPK.version,
        status: newAPK.status,
        uploadedAt: newAPK.uploadedAt,
        downloadCount: newAPK.downloadCount,
        downloadUrl: '/api/referral/apk/download',
      },
    });
  } catch (error) {
    console.error('Error uploading APK:', error);
    res.status(500).json({ message: 'Server error uploading APK', error: error.message });
  }
};

// ─── PUBLIC: Get Active APK Info ─────────────────────────────────────────────
exports.getActiveAPK = async (req, res) => {
  try {
    const activeApk = await APKRelease.findOne({ status: 'active' }).sort({ createdAt: -1 });

    if (!activeApk) {
      return res.json({
        hasActiveApk: false,
        message: 'Android app download is currently unavailable',
      });
    }

    res.json({
      hasActiveApk: true,
      _id: activeApk._id,
      fileName: activeApk.fileName,
      fileSize: activeApk.fileSize,
      version: activeApk.version,
      uploadedAt: activeApk.uploadedAt,
      downloadCount: activeApk.downloadCount,
      downloadUrl: '/api/referral/apk/download',
    });
  } catch (error) {
    console.error('Error getting active APK:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── PUBLIC: Download Active APK ─────────────────────────────────────────────
exports.downloadActiveAPK = async (req, res) => {
  try {
    const activeApk = await APKRelease.findOne({ status: 'active' }).sort({ createdAt: -1 });

    if (!activeApk) {
      return res.status(404).send('Android app download is currently unavailable');
    }

    // Increment download count atomically
    await APKRelease.findByIdAndUpdate(activeApk._id, { $inc: { downloadCount: 1 } });

    // Try serving physical file if it exists
    const physicalPath = path.join(__dirname, '../public/downloads/growvest-latest.apk');
    if (fs.existsSync(physicalPath)) {
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', `attachment; filename="${activeApk.fileName || 'growvest.apk'}"`);
      return res.sendFile(physicalPath);
    }

    // Stream from DB base64 string
    if (activeApk.apkData) {
      const buffer = Buffer.from(activeApk.apkData, 'base64');
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', `attachment; filename="${activeApk.fileName || 'growvest.apk'}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    }

    return res.status(404).send('APK file content missing');
  } catch (error) {
    console.error('Error downloading APK:', error);
    res.status(500).send('Error streaming APK file');
  }
};

// ─── ADMIN: Get Referral Overview & Referral Users Table ───────────────────────
exports.getReferralAdminOverview = async (req, res) => {
  try {
    const referrals = await Referral.find({})
      .populate('referrerUserId', 'name username email mobileNumber referralCode')
      .populate('referredUserId', 'name username email mobileNumber createdAt')
      .sort({ createdAt: -1 });

    const totalReferrals = referrals.length;
    const registeredCount = referrals.filter(r => ['REGISTERED', 'PENDING'].includes(r.status)).length;
    const qualifiedCount = referrals.filter(r => ['SUCCESSFUL', 'REWARDED'].includes(r.status)).length;
    const pendingCount = registeredCount;
    const totalCoinsRewarded = referrals
      .filter(r => ['SUCCESSFUL', 'REWARDED'].includes(r.status))
      .reduce((sum, r) => sum + (r.rewardCoins || 100), 0);

    const activeApk = await APKRelease.findOne({ status: 'active' });
    const totalApkDownloads = activeApk ? activeApk.downloadCount : 0;

    // Build rich table data with real investment status & amounts from DB
    const referralUsers = await Promise.all(
      referrals.map(async (r) => {
        const referred = r.referredUserId || {};
        const referrer = r.referrerUserId || {};

        let investmentStatus = 'None';
        let investmentAmount = 0;

        if (referred._id) {
          // Check Investments
          const inv = await Investment.findOne({ userId: referred._id, status: 'approved' });
          if (inv) {
            investmentStatus = 'Invested';
            investmentAmount += inv.amount || 0;
          }

          // Check Chits
          const chit = await ChitMember.findOne({ userId: referred._id });
          if (chit) {
            investmentStatus = 'Chit Joined';
            investmentAmount += chit.totalPaid || 0;
          }

          // Check Pocket Money
          const pm = await PocketMoney.findOne({ userId: referred._id, status: 'active' });
          if (pm) {
            investmentStatus = 'Pocket Money Active';
            investmentAmount += pm.totalAmount || 0;
          }
        }

        return {
          _id: r._id,
          userName: referred.name || referred.username || 'User',
          userEmail: referred.email || referred.mobileNumber || '—',
          referralCode: r.referralCode || referrer.referralCode || '—',
          referrerName: referrer.name || referrer.username || '—',
          joinedDate: referred.createdAt || r.createdAt,
          investmentStatus,
          investmentAmount,
          referralStatus: r.status,
          rewardCoins: ['SUCCESSFUL', 'REWARDED'].includes(r.status) ? (r.rewardCoins || 100) : 0,
          createdAt: r.createdAt,
        };
      })
    );

    res.json({
      overview: {
        totalReferrals,
        registeredCount,
        qualifiedCount,
        pendingCount,
        totalCoinsRewarded,
        totalApkDownloads,
      },
      referralUsers,
    });
  } catch (error) {
    console.error('Error fetching referral admin overview:', error);
    res.status(500).json({ message: 'Server error fetching referral overview' });
  }
};

// ─── ADMIN: Get All APK Versions ─────────────────────────────────────────────
exports.getAllAPKs = async (req, res) => {
  try {
    const apks = await APKRelease.find({}, '-apkData')
      .populate('uploadedBy', 'name username')
      .sort({ createdAt: -1 });

    res.json(apks);
  } catch (error) {
    console.error('Error getting all APKs:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ─── ADMIN: Delete or Disable APK ────────────────────────────────────────────
exports.deleteAPK = async (req, res) => {
  try {
    const { id } = req.params;
    const apk = await APKRelease.findById(id);

    if (!apk) {
      return res.status(404).json({ message: 'APK record not found' });
    }

    await APKRelease.findByIdAndDelete(id);
    res.json({ message: 'APK release deleted successfully' });
  } catch (error) {
    console.error('Error deleting APK:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
