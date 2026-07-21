const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
  },
  ref: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'withdrawn'],
    default: 'pending',
  },
  type: {
    type: String,
    enum: ['saving', 'fixed'],
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true,
  },
  userName: {
    type: String,
    required: true,
  },
  userEmail: {
    type: String,
    required: false,
  },
  mobileNumber: {
    type: String,
    required: false,
  },
  interestRate: {
    type: Number,
    required: true,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  interestEarned: {
    type: Number,
    default: 0,
  },
  lastInterestCalculatedAt: {
    type: Date,
    default: function() {
      // Set to the start of the startDate day
      const d = new Date(this.startDate || Date.now());
      d.setHours(0, 0, 0, 0);
      return d;
    }
  },
  interestLogicVersion: {
    type: Number,
    default: 1, // 1 is old/wrong, 2 is correct (Feature 2)
  }
}, { timestamps: true });

// Index for fast user-based queries
investmentSchema.index({ userId: 1, status: 1 });
investmentSchema.index({ userEmail: 1 });

module.exports = mongoose.model('Investment', investmentSchema);