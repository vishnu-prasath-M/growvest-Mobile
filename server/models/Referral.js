const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  referredUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  referralCode: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['REGISTERED', 'PENDING', 'SUCCESSFUL', 'REWARDED'],
    default: 'REGISTERED',
  },
  qualifyingInvestmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investment',
    default: null,
  },
  rewardCoins: {
    type: Number,
    default: 100,
  },
  rewardedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Referral', referralSchema);
