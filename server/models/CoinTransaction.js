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
    enum: ['REFERRAL_REWARD', 'DAILY_REWARD', 'TASK_REWARD', 'OTHER_REWARD'],
    default: 'REFERRAL_REWARD',
  },
  amount: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('CoinTransaction', coinTransactionSchema);
