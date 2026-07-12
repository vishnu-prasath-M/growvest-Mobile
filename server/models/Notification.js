const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  type: { type: String, required: true, enum: [
    'investment_approved',
    'investment_rejected',
    'chit_joined',
    'chit_payment_approved',
    'chit_payment_rejected',
    'new_chit_available',
    'due_reminder',
    'kyc_approved',
    'kyc_rejected',
    'general'
  ]},
  icon: { type: String, default: 'bell-outline' },
  read: { type: Boolean, default: false },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, {
  timestamps: true
});

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);