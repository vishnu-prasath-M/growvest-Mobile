const mongoose = require('mongoose');

const chitWinnerSchema = new mongoose.Schema({
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
  winningAmount: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    required: true,
  },
  wonAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

chitWinnerSchema.index({ chitId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('ChitWinner', chitWinnerSchema);