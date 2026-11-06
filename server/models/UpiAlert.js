const mongoose = require('mongoose');

const upiAlertSchema = new mongoose.Schema(
  {
    utr: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    bank: {
      type: String,
      default: null,
    },
    payer: {
      type: String,
      default: null,
    },
    ref: {
      type: String,
      default: null,
      index: true,
    },
    receivedAt: {
      type: Date,
      required: true,
      index: true,
    },
    paymentId: {
      type: String,
      default: null,
      index: true,
    },
    rawSnippet: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

upiAlertSchema.index({ paymentId: 1, receivedAt: 1 });
upiAlertSchema.index({ amount: 1, paymentId: 1 });

module.exports = mongoose.model('UpiAlert', upiAlertSchema);
