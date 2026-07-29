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
    enum: ['pending', 'active', 'cancelled'],
    default: 'pending',
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
}, { timestamps: true });

// Each user can join a chit only once
chitMemberSchema.index({ chitId: 1, userId: 1 }, { unique: true });
chitMemberSchema.index({ userId: 1 });
chitMemberSchema.index({ chitId: 1 });

module.exports = mongoose.model('ChitMember', chitMemberSchema);
