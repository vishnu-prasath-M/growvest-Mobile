const mongoose = require('mongoose');

const chitAuctionSchema = new mongoose.Schema({
  chitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chit',
    required: true,
  },
  month: {
    type: Number,
    required: true,
  },
  auctionDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['upcoming', 'active', 'completed', 'cancelled'],
    default: 'upcoming',
  },
  winnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChitMember',
  },
  winningAmount: {
    type: Number,
  },
  discount: {
    type: Number,
  },
  dividendPerMember: {
    type: Number,
  },
  participants: {
    type: Number,
    default: 0,
  },
  bids: [{
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChitMember' },
    amount: { type: Number },
    bidTime: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

chitAuctionSchema.index({ chitId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('ChitAuction', chitAuctionSchema);