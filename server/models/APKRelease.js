const mongoose = require('mongoose');

const apkReleaseSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true }, // size in bytes
  storagePath: { type: String, default: '' },
  apkData: { type: String }, // Base64 representation for persistent storage across deployments
  version: { type: String, default: '1.0.0' },
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  downloadCount: { type: Number, default: 0 },
}, {
  timestamps: true
});

module.exports = mongoose.model('APKRelease', apkReleaseSchema);
