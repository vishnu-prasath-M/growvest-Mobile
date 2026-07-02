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
  userEmail: {
    type: String,
    required: true,
  },
  memberNumber: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'cancelled', 'completed'],
    default: 'active',
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
  joinedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

chitMemberSchema.index({ chitId: 1, userId: 1 }, { unique: true });
chitMemberSchema.index({ userId: 1 });

module.exports = mongoose.model('ChitMember', chitMemberSchema);