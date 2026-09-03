const mongoose = require('mongoose');

const sipContributionSchema = new mongoose.Schema({
  contributionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  sipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SIP',
    required: true,
    index: true,
  },
  sipRefId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  installmentNumber: {
    type: Number,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  dueDate: {
    type: Date,
    required: true,
  },
  paidAt: {
    type: Date,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'cancelled'],
    default: 'pending',
    index: true,
  },
  paymentProvider: {
    type: String,
    default: 'Razorpay',
  },
  orderId: {
    type: String,
  },
  paymentId: {
    type: String,
  },
  signature: {
    type: String,
  },
  withdrawalStatus: {
    type: String,
    enum: ['available', 'requested', 'withdrawn'],
    default: 'available',
  },
  withdrawableAmount: {
    type: Number,
    default: 0,
  },
  eligibleDate: {
    type: Date,
  },
  failureReason: {
    type: String,
  },
  receiptId: {
    type: String,
  },
}, { timestamps: true });

sipContributionSchema.index({ sipId: 1, installmentNumber: 1 });
sipContributionSchema.index({ userId: 1, paymentStatus: 1 });
sipContributionSchema.index({ dueDate: 1, paymentStatus: 1 });

module.exports = mongoose.model('SIPContribution', sipContributionSchema);
