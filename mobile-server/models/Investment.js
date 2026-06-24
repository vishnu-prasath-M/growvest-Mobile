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
      const d = new Date(this.startDate || Date.now());
      d.setHours(0, 0, 0, 0);
      return d;
    }
  },
  interestLogicVersion: {
    type: Number,
    default: 1,
  }
}, { timestamps: true });

module.exports = mongoose.model('Investment', investmentSchema);
