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
    default: 0,
  },
  signupRewarded: {
    type: Boolean,
    default: false,
  },
  kycRewarded: {
    type: Boolean,
    default: false,
  },
  firstInvestmentRewarded: {
    type: Boolean,
    default: false,
  },
  milestoneRewarded: {
    type: Boolean,
    default: false,
  },
  totalCoinsAwarded: {
    type: Number,
    default: 0,
  },
  rewardedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Referral', referralSchema);
