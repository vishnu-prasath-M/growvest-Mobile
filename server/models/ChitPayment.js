const mongoose = require('mongoose');

const chitPaymentSchema = new mongoose.Schema({
  chitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chit',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChitMember',
    required: true,
  },
  month: {
    type: Number,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  lateFee: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'rejected'],
    default: 'pending',
  },
  dueDate: {
    type: Date,
  },
  paidDate: {
    type: Date,
  },
  receiptId: {
    type: String,
  },
}, { timestamps: true });

// Fast queries for user payments and pending admin approvals
chitPaymentSchema.index({ userId: 1, createdAt: -1 });
chitPaymentSchema.index({ chitId: 1, status: 1 });
chitPaymentSchema.index({ memberId: 1 });
chitPaymentSchema.index({ status: 1 });

module.exports = mongoose.model('ChitPayment', chitPaymentSchema);
