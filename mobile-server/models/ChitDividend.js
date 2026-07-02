const mongoose = require('mongoose');

const chitDividendSchema = new mongoose.Schema({
  chitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chit',
    required: true,
  },
  auctionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChitAuction',
    required: true,
  },
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChitMember',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  status: {
    type: String,
    enum: ['pending', 'credited', 'failed'],
    default: 'pending',
  },
  creditedAt: {
    type: Date,
  },
  transactionId: {
    type: String,
  },
}, { timestamps: true });

chitDividendSchema.index({ userId: 1, month: -1 });

module.exports = mongoose.model('ChitDividend', chitDividendSchema);