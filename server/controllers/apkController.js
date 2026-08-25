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

    const fileObj = req.file;
    const name = (fileName || fileObj?.originalname || 'growvest.apk').toString().trim();

    if (!fileObj && !base64Data) {
      return res.status(400).json({ message: 'APK file data is required' });
    }

    // Validate extension
    if (!name.toLowerCase().endsWith('.apk')) {
      return res.status(400).json({ message: 'Invalid file format. Only .apk files are allowed.' });
    }

    let fileSize = 0;
    let fileBuffer = null;

    if (fileObj && fileObj.buffer) {
      fileSize = fileObj.size;
      fileBuffer = fileObj.buffer;
    } else if (base64Data) {
      const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
      fileBuffer = Buffer.from(cleanBase64, 'base64');
      fileSize = fileBuffer.length;
    }

    if (!fileBuffer || fileSize < 100) {
      return res.status(400).json({ message: 'Invalid APK file content or empty file' });
    }

    // Ensure downloads directory exists
    const downloadsDir = path.join(__dirname, '../public/downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    // Write file directly to public downloads folder
    const physicalPath = path.join(downloadsDir, 'growvest-latest.apk');
    fs.writeFileSync(physicalPath, fileBuffer);

    // Mark all existing active APKs as inactive
    await APKRelease.updateMany({ status: 'active' }, { status: 'inactive' });

    // Store raw buffer in MongoDB ONLY if file size is <= 14 MB to prevent MongoDB 16MB BSON document limit crash
    const safeBufferInDb = fileSize <= 14 * 1024 * 1024 ? fileBuffer : null;

    // Create new active APK metadata record in DB
    const newAPK = await APKRelease.create({
      fileName: name,
      fileSize,
      storagePath: '/downloads/growvest-latest.apk',
      apkData: safeBufferInDb,
      version: version || '1.0.0',
      uploadedBy: adminId,
      status: 'active',
      downloadCount: 0,
    });

    res.status(201).json({
      message: 'APK uploaded successfully and saved persistently in database!',
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
    const activeApk = await APKRelease.findOne({ status: 'active' })
      .select('+apkData')
      .sort({ createdAt: -1 });

    if (!activeApk) {
      if (process.env.APK_DOWNLOAD_URL) {
        return res.redirect(process.env.APK_DOWNLOAD_URL);
      }
      return res.status(404).send('Android app download is currently unavailable');
    }

    // Increment download count atomically
    await APKRelease.findByIdAndUpdate(activeApk._id, { $inc: { downloadCount: 1 } });

    const downloadsDir = path.join(__dirname, '../public/downloads');
    const physicalPath = path.join(downloadsDir, 'growvest-latest.apk');

    // 1. If physical file exists on local disk, serve directly
    if (fs.existsSync(physicalPath)) {
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', `attachment; filename="${activeApk.fileName || 'growvest.apk'}"`);
      return res.sendFile(physicalPath);
    }

    // 2. If Render restarted & local disk file was wiped, restore directly from MongoDB persistent buffer!
    if (activeApk.apkData && activeApk.apkData.length > 0) {
      try {
        if (!fs.existsSync(downloadsDir)) {
          fs.mkdirSync(downloadsDir, { recursive: true });
        }
        // Write restored file back to disk for subsequent fast streaming
        fs.writeFileSync(physicalPath, activeApk.apkData);
        console.log(`[APKDownload] Restored APK file (${activeApk.fileSize} bytes) from MongoDB database to disk after Render restart!`);

        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', `attachment; filename="${activeApk.fileName || 'growvest.apk'}"`);
        return res.send(activeApk.apkData);
      } catch (restoreErr) {
        console.error('[APKDownload] File restoration error, streaming directly from memory:', restoreErr);
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        res.setHeader('Content-Disposition', `attachment; filename="${activeApk.fileName || 'growvest.apk'}"`);
        return res.send(activeApk.apkData);
      }
    }

    // 3. Fallback to external URL if configured
    if (activeApk.externalUrl) {
      return res.redirect(activeApk.externalUrl);
    }

    if (process.env.APK_DOWNLOAD_URL) {
      return res.redirect(process.env.APK_DOWNLOAD_URL);
    }

    return res.status(404).send('APK file currently updating');
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
