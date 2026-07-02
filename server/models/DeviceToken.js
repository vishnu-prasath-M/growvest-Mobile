const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  deviceToken: { type: String, required: true, unique: true },
  platform: { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
