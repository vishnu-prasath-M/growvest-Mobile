const mongoose = require('mongoose');

const pocketMoneySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  userEmail: {
    type: String,
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  mobileNumber: {
    type: String,
  },
  investedAmount: {
    type: Number,
    required: true,
  },
  remainingAmount: {
    type: Number,
    required: true,
  },
  payoutAmount: {
    type: Number,
    required: true,
  },
  frequency: {
    type: String,
    enum: ['daily', 'every_2_days', 'weekly'],
    required: true,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  nextPayoutDate: {
    type: Date,
    required: true,
  },
  totalPaidOut: {
    type: Number,
    default: 0,
  },
  payoutCount: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'paused', 'completed'],
    default: 'pending',
  },
  // Bonus fields
  bonusRate: {
    type: Number,
    default: 6,
  },
  bonusAmount: {
    type: Number,
    required: true,
  },
  totalFinalValue: {
    type: Number,
    required: true,
  },
  bonusReleased: {
    type: Boolean,
    default: false,
  },
  finalPayoutDate: {
    type: Date,
  },
  // Payment info
  paymentProvider: { type: String, default: 'Razorpay' },
  orderId: { type: String },
  paymentId: { type: String },
  signature: { type: String },
  paidAt: { type: Date },
  completedAt: { type: Date, default: null }
}, {
  timestamps: true
});

module.exports = mongoose.model('PocketMoney', pocketMoneySchema);
