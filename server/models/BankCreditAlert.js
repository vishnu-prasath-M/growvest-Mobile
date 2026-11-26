const mongoose = require('mongoose');

const bankCreditAlertSchema = new mongoose.Schema(
  {
    utr: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    sender: {
      type: String,
      default: '',
      trim: true,
    },
    source: {
      type: String,
      enum: ['gmail', 'sms', 'manual'],
      default: 'gmail',
    },
    rawText: {
      type: String,
      default: '',
    },
    matched: {
      type: Boolean,
      default: false,
      index: true,
    },
    matchedOrderId: {
      type: String,
      default: '',
    },
    matchedAt: {
      type: Date,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BankCreditAlert', bankCreditAlertSchema);
