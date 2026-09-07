const APKRelease = require('../models/APKRelease');
const Referral = require('../models/Referral');
const User = require('../models/User');
const Investment = require('../models/Investment');
const ChitMember = require('../models/ChitMember');
const PocketMoney = require('../models/PocketMoney');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { Readable } = require('stream');

function getGridFSBucket() {
  if (mongoose.connection && mongoose.connection.db) {
    return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'apk_files' });
  }
  return null;
}

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

    // Save permanently to MongoDB GridFS (handles ANY file size without 16MB BSON limit)
    let gridFsFileId = null;
    const gridFsBucket = getGridFSBucket();
    if (gridFsBucket) {
      // 1. Purge old GridFS files to prevent storage accumulation in MongoDB
      try {
        const oldGridFiles = await mongoose.connection.db.collection('apk_files.files').find({}).toArray();
        for (const oldF of oldGridFiles) {
          try {
            await gridFsBucket.delete(oldF._id);
            console.log(`[APKUpload] Purged previous GridFS file ${oldF._id}`);
          } catch (delErr) {
            console.error(`[APKUpload] Error deleting old GridFS file:`, delErr.message);
          }
        }
      } catch (purgeErr) {
        console.error('[APKUpload] Error purging old GridFS files:', purgeErr.message);
      }

      const readableStream = new Readable();
      readableStream.push(fileBuffer);
      readableStream.push(null);

      const uploadStream = gridFsBucket.openUploadStream(name, {
        contentType: 'application/vnd.android.package-archive',
        metadata: { version: version || '1.0.0', uploadedBy: adminId },
      });

      await new Promise((resolve, reject) => {
        readableStream.pipe(uploadStream)
          .on('error', reject)
          .on('finish', resolve);
      });

      gridFsFileId = uploadStream.id;
      console.log(`[APKUpload] APK permanently stored in MongoDB GridFS with ID: ${gridFsFileId} (${fileSize} bytes)`);
    }

    // Clean up inactive records in DB to save metadata space
    await APKRelease.deleteMany({ status: { $ne: 'active' } });
    await APKRelease.updateMany({}, { status: 'inactive' });

    // Store raw buffer in MongoDB ONLY if file size is <= 14 MB to prevent MongoDB 16MB BSON document limit crash
    const safeBufferInDb = fileSize <= 14 * 1024 * 1024 ? fileBuffer : null;

    // Create new active APK metadata record in DB
    const newAPK = await APKRelease.create({
      fileName: name,
      fileSize,
      storagePath: '/downloads/growvest-latest.apk',
      gridFsFileId,
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

let restorePromise = null;

// Helper to ensure APK file is physically on local disk (restored from GridFS if ephemeral disk was cleared on Render restart)
async function syncApkFromGridFSToDisk() {
  if (restorePromise) return restorePromise;

  restorePromise = (async () => {
    try {
      const downloadsDir = path.join(__dirname, '../public/downloads');
      if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true });
      }

      const physicalPath = path.join(downloadsDir, 'growvest-latest.apk');
      const activeApk = await APKRelease.findOne({ status: 'active' })
        .select('+apkData')
        .sort({ createdAt: -1 });

      if (!activeApk) return false;

      // Check if file already exists on disk with matching valid size
      if (fs.existsSync(physicalPath)) {
        const stats = fs.statSync(physicalPath);
        if (stats.size > 1000 && (!activeApk.fileSize || Math.abs(stats.size - activeApk.fileSize) < 100)) {
          return true; // Already on disk and intact!
        }
      }

      // 1. Restore from GridFS if available
      const gridFsBucket = getGridFSBucket();
      if (activeApk.gridFsFileId && gridFsBucket) {
        console.log(`[APKRestore] Auto-restoring APK from MongoDB GridFS (${activeApk.gridFsFileId}) to local disk...`);
        const tempPath = path.join(downloadsDir, `growvest-latest.tmp.${Date.now()}`);
        const writeStream = fs.createWriteStream(tempPath);
        const downloadStream = gridFsBucket.openDownloadStream(new mongoose.Types.ObjectId(activeApk.gridFsFileId));

        await new Promise((resolve, reject) => {
          downloadStream.pipe(writeStream)
            .on('finish', resolve)
            .on('error', reject);
        });

        if (fs.existsSync(tempPath) && fs.statSync(tempPath).size > 1000) {
          fs.renameSync(tempPath, physicalPath);
          console.log(`[APKRestore] APK restored successfully to ${physicalPath} (${fs.statSync(physicalPath).size} bytes)`);
          return true;
        }
      }

      // 2. Fallback: restore from DB buffer if present
      if (activeApk.apkData && activeApk.apkData.length > 0) {
        fs.writeFileSync(physicalPath, activeApk.apkData);
        console.log(`[APKRestore] APK restored from DB buffer to ${physicalPath}`);
        return true;
      }

      return false;
    } catch (err) {
      console.error('[APKRestore] Error restoring APK from GridFS to disk:', err.message);
      return false;
    } finally {
      restorePromise = null;
    }
  })();

  return restorePromise;
}

exports.syncApkFromGridFSToDisk = syncApkFromGridFSToDisk;

// ─── ADMIN: Set External APK Download URL ────────────────────────────────────
exports.setExternalApkUrl = async (req, res) => {
  try {
    const adminId = req.user._id || req.user.id;
    const { externalUrl, fileName, version } = req.body;

    if (!externalUrl || !externalUrl.trim().startsWith('http')) {
      return res.status(400).json({ message: 'Valid external HTTP/HTTPS download URL is required' });
    }

    const name = (fileName || 'Growvest.apk').trim();

    await APKRelease.updateMany({}, { status: 'inactive' });

    const newAPK = await APKRelease.create({
      fileName: name,
      fileSize: 0,
      storagePath: '/downloads/growvest-latest.apk',
      externalUrl: externalUrl.trim(),
      version: version || '1.0.0',
      uploadedBy: adminId,
      status: 'active',
      downloadCount: 0,
    });

    res.status(201).json({
      message: 'External APK URL configured successfully!',
      apk: newAPK,
    });
  } catch (error) {
    console.error('Error setting external APK URL:', error);
    res.status(500).json({ message: 'Server error setting external APK URL' });
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
      externalUrl: activeApk.externalUrl || '',
      uploadedAt: activeApk.uploadedAt,
      downloadCount: activeApk.downloadCount,
      downloadUrl: activeApk.externalUrl || '/api/referral/apk/download',
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

    // Direct redirection if external CDN/S3/Drive URL is configured
    if (activeApk.externalUrl && activeApk.externalUrl.trim().startsWith('http')) {
      await APKRelease.findByIdAndUpdate(activeApk._id, { $inc: { downloadCount: 1 } });
      return res.redirect(activeApk.externalUrl.trim());
    }

    // Increment download count atomically
    await APKRelease.findByIdAndUpdate(activeApk._id, { $inc: { downloadCount: 1 } });

    // If ref query param is present, track referral lead
    const refCode = (req.query.ref || '').toString().trim().toUpperCase();
    if (refCode) {
      try {
        const ReferralLead = require('../models/ReferralLead');
        const referrer = await User.findOne({ referralCode: refCode });
        if (referrer) {
          const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
          const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
          const existingLead = await ReferralLead.findOne({
            referrerUserId: referrer._id,
            referralCode: refCode,
            type: 'APK_DOWNLOAD',
            ipAddress: clientIp,
            createdAt: { $gte: tenMinAgo },
          });

          if (!existingLead) {
            await ReferralLead.create({
              referrerUserId: referrer._id,
              referralCode: refCode,
              type: 'APK_DOWNLOAD',
              ipAddress: clientIp,
              userAgent: req.headers['user-agent'] || '',
              device: 'Android Mobile',
              status: 'DOWNLOADED',
            });

            const { sendNotification } = require('../services/notificationHelper');
            await sendNotification({
              userId: referrer._id,
              title: '📱 Friend Downloaded the App!',
              description: 'Someone just downloaded Growvest using your referral link. You will earn Coins once they register!',
              type: 'referral_lead',
              pushData: { screen: 'Referral' },
            });
          }
        }
      } catch (leadErr) {
        console.warn('[APKDownload Lead Track Warning]', leadErr.message);
      }
    }

    const downloadsDir = path.join(__dirname, '../public/downloads');
    const physicalPath = path.join(downloadsDir, 'growvest-latest.apk');
    const filename = activeApk.fileName || 'Growvest.apk';

    // 1. Ensure file exists on local disk (restores from MongoDB GridFS if wiped during Render cold restart)
    if (!fs.existsSync(physicalPath) || fs.statSync(physicalPath).size < 1000) {
      await syncApkFromGridFSToDisk();
    }

    // 2. Serve from disk using Express res.download (handles Range headers, HTTP 206 Partial Content, Resuming, Android Download Manager)
    if (fs.existsSync(physicalPath) && fs.statSync(physicalPath).size > 1000) {
      return res.download(physicalPath, filename, (err) => {
        if (err && !res.headersSent) {
          console.error('[APKDownload] res.download error:', err.message);
        }
      });
    }

    // 3. Fallback: Stream directly from MongoDB GridFS
    const gridFsBucket = getGridFSBucket();
    if (activeApk.gridFsFileId && gridFsBucket) {
      console.log(`[APKDownload] Fallback: Streaming APK directly from MongoDB GridFS (ID: ${activeApk.gridFsFileId})`);
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Accept-Ranges', 'bytes');
      if (activeApk.fileSize) {
        res.setHeader('Content-Length', activeApk.fileSize);
      }

      const downloadStream = gridFsBucket.openDownloadStream(new mongoose.Types.ObjectId(activeApk.gridFsFileId));
      downloadStream.on('error', (err) => {
        console.error('[APKDownload] GridFS stream error:', err);
        if (!res.headersSent) res.status(500).send('Error streaming APK file');
      });

      return downloadStream.pipe(res);
    }

    // 4. Fallback to MongoDB persistent buffer
    if (activeApk.apkData && activeApk.apkData.length > 0) {
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(activeApk.apkData);
    }

    if (process.env.APK_DOWNLOAD_URL) {
      return res.redirect(process.env.APK_DOWNLOAD_URL);
    }

    return res.status(404).send('APK file currently updating. Please try again in a few moments.');
  } catch (error) {
    console.error('Error downloading APK:', error);
    if (!res.headersSent) {
      res.status(500).send('Error streaming APK file');
    }
  }
};

// ─── ADMIN: Get Referral Overview & Referral Users Table ───────────────────────
exports.getReferralAdminOverview = async (req, res) => {
  try {
    const KYC = require('../models/KYC');
    const CoinTransaction = require('../models/CoinTransaction');
    const Settings = require('../models/Settings');

    const referrals = await Referral.find({})
      .populate('referrerUserId', 'name username email mobileNumber referralCode')
      .populate('referredUserId', 'name username email mobileNumber createdAt')
      .sort({ createdAt: -1 });

    const totalUsersCount = await User.countDocuments({});
    const totalReferrals = referrals.length;
    const registeredCount = referrals.length;
    const qualifiedCount = referrals.filter(r => ['SUCCESSFUL', 'REWARDED'].includes(r.status) || r.milestoneRewarded).length;
    const pendingCount = totalReferrals - qualifiedCount;

    // Total coins rewarded from CoinTransaction
    const coinAgg = await CoinTransaction.aggregate([
      { $match: { coins: { $gt: 0 } } },
      { $group: { _id: null, totalCoins: { $sum: '$coins' } } }
    ]);
    const totalCoinsRewarded = coinAgg[0]?.totalCoins || 0;
    const totalRewardRupees = Number((totalCoinsRewarded * 0.05).toFixed(2));

    // Pending reward withdrawals
    const Withdrawal = require('../models/Withdrawal');
    const pendingWithdrawalsCount = await Withdrawal.countDocuments({ withdrawType: 'reward', status: 'pending' });

    // Active APK info
    const activeApk = await APKRelease.findOne({ status: 'active' });
    const totalApkDownloads = activeApk ? activeApk.downloadCount : 0;

    // Minimum withdrawal threshold
    const minSetting = await Settings.findOne({ key: 'min_reward_withdrawal_coins' });
    const minWithdrawalCoins = minSetting ? parseInt(minSetting.value, 10) : 1000;

    // Build rich table data with real milestone statuses
    const referralUsers = await Promise.all(
      referrals.map(async (r) => {
        const referred = r.referredUserId || {};
        const referrer = r.referrerUserId || {};

        let investmentStatus = 'None';
        let investmentAmount = 0;
        let kycStatus = 'not_submitted';

        if (referred._id) {
          // Check KYC
          const kyc = await KYC.findOne({ userId: referred._id });
          if (kyc) kycStatus = kyc.status;

          // Check Investments
          const inv = await Investment.findOne({ userId: referred._id, status: 'approved' });
          if (inv) {
            investmentStatus = 'Invested';
            investmentAmount += inv.amount || 0;
          }

          // Check Chits
          const chit = await ChitMember.findOne({ userId: referred._id });
          if (chit) {
            investmentStatus = investmentStatus === 'None' ? 'Chit Joined' : `${investmentStatus} + Chit`;
            investmentAmount += chit.totalPaid || 0;
          }

          // Check Pocket Money
          const pm = await PocketMoney.findOne({ userId: referred._id, status: 'active' });
          if (pm) {
            investmentStatus = investmentStatus === 'None' ? 'Pocket Money' : `${investmentStatus} + Pocket`;
            investmentAmount += pm.investedAmount || 0;
          }
        }

        const coinsAwarded = r.totalCoinsAwarded || r.rewardCoins || (
          (r.signupRewarded ? 20 : 0) +
          (r.kycRewarded ? 30 : 0) +
          (r.firstInvestmentRewarded ? 50 : 0) +
          (r.milestoneRewarded ? 100 : 0)
        );

        return {
          _id: r._id,
          userName: referred.name || referred.username || 'User',
          userEmail: referred.email || referred.mobileNumber || '—',
          referralCode: r.referralCode || referrer.referralCode || '—',
          referrerName: referrer.name || referrer.username || '—',
          joinedDate: referred.createdAt || r.createdAt,
          investmentStatus,
          investmentAmount,
          kycStatus,
          signupRewarded: r.signupRewarded ?? true,
          kycRewarded: r.kycRewarded ?? (kycStatus === 'approved'),
          firstInvestmentRewarded: r.firstInvestmentRewarded ?? (investmentAmount > 0),
          milestoneRewarded: r.milestoneRewarded ?? ['SUCCESSFUL', 'REWARDED'].includes(r.status),
          referralStatus: r.status,
          rewardCoins: coinsAwarded,
          rewardRupees: Number((coinsAwarded * 0.05).toFixed(2)),
          createdAt: r.createdAt,
        };
      })
    );

    res.json({
      overview: {
        totalUsersCount,
        totalReferrals,
        registeredCount,
        qualifiedCount,
        pendingCount,
        totalCoinsRewarded,
        totalRewardRupees,
        pendingWithdrawalsCount,
        totalApkDownloads,
        minWithdrawalCoins,
        minWithdrawalRupees: Number((minWithdrawalCoins * 0.05).toFixed(2)),
        conversionRate: '20 Coins = ₹1 (₹0.05/coin)',
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
