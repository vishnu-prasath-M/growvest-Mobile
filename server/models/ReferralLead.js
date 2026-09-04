const mongoose = require('mongoose');

const referralLeadSchema = new mongoose.Schema({
  referrerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  referralCode: {
    type: String,
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['LINK_VISIT', 'APK_DOWNLOAD'],
    default: 'APK_DOWNLOAD',
  },
  device: {
    type: String,
    default: 'Android Device',
  },
  ipAddress: {
    type: String,
    default: '',
  },
  userAgent: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['DOWNLOADED', 'REGISTERED'],
    default: 'DOWNLOADED',
  },
  registeredUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('ReferralLead', referralLeadSchema);
