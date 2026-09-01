const mongoose = require('mongoose');

const chitMemberSchema = new mongoose.Schema({
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
  memberNumber: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'cancelled', 'rejected'],
    default: 'pending',
  },
  adminApprovalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  approvedAt: {
    type: Date,
  },
  rejectedAt: {
    type: Date,
  },
  rejectionReason: {
    type: String,
  },
  totalPaid: {
    type: Number,
    default: 0,
  },
  remainingAmount: {
    type: Number,
    default: 0,
  },
  currentMonth: {
    type: Number,
    default: 0,
  },
  hasWon: {
    type: Boolean,
    default: false,
  },
  winningDate: {
    type: Date,
  },
  winningAmount: {
    type: Number,
    default: 0,
  },
  winningTransactionRef: {
    type: String,
  },
  nextDueDate: {
    type: Date,
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
  weeklyAmount: {
    type: Number,
  },
  totalWeeks: {
    type: Number,
  },
  totalContribution: {
    type: Number,
  },
  currentWeek: {
    type: Number,
    default: 0,
  },
  paidWeeks: {
    type: Number,
    default: 0,
  },
  unpaidWeeks: {
    type: Number,
    default: 0,
  },
  withdrawalStatus: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending',
  },
  withdrawalWeek: {
    type: Number,
  },
  withdrawalAmount: {
    type: Number,
  },
  totalDividendEarned: {
    type: Number,
    default: 0,
  },
  settlementAmount: {
    type: Number,
  },
  penaltiesPaid: {
    type: Number,
    default: 0,
  },
  penaltiesUnpaid: {
    type: Number,
    default: 0,
  },
  withdrawnAt: {
    type: Date,
  },
  actionPercentage: {
    type: Number,
  },
  priceAmount: {
    type: Number,
  },
  accumulatedDividend: {
    type: Number,
  },
  membershipId: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
  },
}, { timestamps: true });

// Indexes for fast lookup (users can join the same chit multiple times)
chitMemberSchema.index({ userId: 1 });
chitMemberSchema.index({ chitId: 1 });
chitMemberSchema.index({ membershipId: 1 });

module.exports = mongoose.model('ChitMember', chitMemberSchema);
