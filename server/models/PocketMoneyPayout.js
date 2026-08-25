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
  status: {
    type: String,
    enum: ['requested', 'released', 'rejected'],
    default: 'requested',
    required: true,
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
  }
}, {
  timestamps: true
});

// Compound indexes for fast per-investment status lookup & idempotency enforcement
pocketMoneyPayoutSchema.index({ pocketMoneyId: 1, payoutNumber: 1 });
pocketMoneyPayoutSchema.index({ pocketMoneyId: 1, idempotencyKey: 1 });

module.exports = mongoose.model('PocketMoneyPayout', pocketMoneyPayoutSchema);
