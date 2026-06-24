const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  userEmail: {
    type: String,
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  upiId: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'paid'],
    default: 'pending',
  },
  withdrawType: {
    type: String,
    enum: ['saving', 'fixed'],
    default: 'saving',
  },
  paidAt: {
    type: Date,
  },
  date: {
    type: String,
  },
  processed: {
    type: Boolean,
    default: false,
  }
}, { timestamps: true });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);