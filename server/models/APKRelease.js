const mongoose = require('mongoose');

const apkReleaseSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true }, // size in bytes
  storagePath: { type: String, default: '/downloads/growvest-latest.apk' },
  externalUrl: { type: String, default: '' },
  gridFsFileId: { type: mongoose.Schema.Types.ObjectId, default: null }, // GridFS reference for unlimited APK file size in MongoDB
  apkData: { type: Buffer, select: false }, // Persistent binary storage in MongoDB
  version: { type: String, default: '1.0.0' },
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  downloadCount: { type: Number, default: 0 },
}, {
  timestamps: true
});

module.exports = mongoose.model('APKRelease', apkReleaseSchema);
