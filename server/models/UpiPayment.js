const mongoose = require('mongoose');

const upiPaymentSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    orderId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    payAmount: {
      type: Number,
      required: true,
      index: true,
    },
    ref: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'underpaid', 'expired'],
      default: 'pending',
      index: true,
    },
    customer: {
      type: String,
      default: null,
    },
    note: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    paidAmount: {
      type: Number,
      default: null,
    },
    utr: {
      type: String,
      default: null,
      index: true,
    },
    bank: {
      type: String,
      default: null,
    },
    payer: {
      type: String,
      default: null,
    },
    matchedBy: {
      type: String,
      default: null,
    },
    utrTries: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

upiPaymentSchema.index({ status: 1, expiresAt: 1 });
upiPaymentSchema.index({ payAmount: 1, status: 1 });

module.exports = mongoose.model('UpiPayment', upiPaymentSchema);
