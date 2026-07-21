const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true,
  },
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
  paidBy: {
    type: String,
  },
  processed: {
    type: Boolean,
    default: false,
  },
  date: {
    type: String, // String for easier display on frontend matching previous logic
  }
}, { timestamps: true });

// Index for fast user-based queries
withdrawalSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Withdrawal', withdrawalSchema);