const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String },
  username: { type: String, required: true, unique: true },
  mobileNumber: { type: String, required: true, unique: true },
  email: { type: String, sparse: true, unique: true },
  password: { type: String, required: true },
  balance: { type: Number, default: 0 },
  role: { type: String, default: 'user' },
  fcmTokens: [{
    token: { type: String, required: true },
    platform: { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
    deviceId: { type: String },
    updatedAt: { type: Date, default: Date.now },
  }],
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
