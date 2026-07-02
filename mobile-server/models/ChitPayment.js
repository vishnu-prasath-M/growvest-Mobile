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
    enum: ['paid', 'pending', 'failed', 'refunded'],
    default: 'pending',
  },
  dueDate: {
    type: Date,
    required: true,
  },
  paidDate: {
    type: Date,
  },
  transactionId: {
    type: String,
  },
  receiptId: {
    type: String,
  },
  paymentMethod: {
    type: String,
  },
}, { timestamps: true });

chitPaymentSchema.index({ chitId: 1, userId: 1, month: 1 }, { unique: true });
chitPaymentSchema.index({ userId: 1 });

module.exports = mongoose.model('ChitPayment', chitPaymentSchema);