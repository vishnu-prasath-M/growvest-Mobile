const mongoose = require('mongoose');

const manualPaymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    paymentType: {
      type: String,
      required: true,
      enum: ['investment', 'chit_join', 'chit_payment', 'pocket_money', 'sip_initial', 'sip_installment'],
    },
    amount: {
      type: Number,
      required: true,
    },
    payloadData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    utr: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    screenshotUrl: {
      type: String,
      default: '',
    },
    userRemarks: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    adminRemarks: {
      type: String,
      default: '',
      trim: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

manualPaymentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ManualPayment', manualPaymentSchema);
