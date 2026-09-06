const mongoose = require('mongoose');

const coinTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: [
      'DAILY_LOGIN',
      'FIRST_INVESTMENT',
      'FIRST_CHIT',
      'FIRST_POCKET_MONEY',
      'REFERRAL_SIGNUP',
      'REFERRAL_KYC',
      'REFERRAL_FIRST_INVESTMENT',
      'REFERRAL_SUCCESSFUL',
      'REFERRAL_REWARD',
      'COIN_WITHDRAWAL',
      'COIN_REFUND',
      'ADMIN_CREDIT',
      'ADMIN_DEBIT',
      'POCKET_MONEY_INTEREST_REWARD',
      'OTHER_REWARD',
    ],
    required: true,
  },
  coins: {
    type: Number,
    required: true,
  },
  amount: {
    type: Number,
    default: function () {
      return this.coins;
    },
  },
  rupeeValue: {
    type: Number,
    default: function () {
      return (this.coins || 0) * 0.05; // 20 Coins = ₹1 (₹0.05/coin)
    },
  },
  description: {
    type: String,
    required: true,
  },
  sourceEvent: {
    type: String,
    default: null,
  },
  referralId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Referral',
    default: null,
  },
  referenceId: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['COMPLETED', 'PENDING', 'REVERSED'],
    default: 'COMPLETED',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('CoinTransaction', coinTransactionSchema);
