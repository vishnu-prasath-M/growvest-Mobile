const mongoose = require('mongoose');

const pocketMoneyPayoutSchema = new mongoose.Schema({
  pocketMoneyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PocketMoney',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  payoutDate: {
    type: Date,
    required: true,
  },
  payoutNumber: {
    type: Number,
    required: true,
  },
  idempotencyKey: {
    type: String,
    required: true,
    unique: true, // e.g., PM_{pocketId}_{payoutDate_YYYY_MM_DD}
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PocketMoneyPayout', pocketMoneyPayoutSchema);
