const mongoose = require('mongoose');

const sipSchema = new mongoose.Schema({
  sipId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
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
  mobileNumber: {
    type: String,
  },
  amount: {
    type: Number,
    required: true,
    min: 100,
  },
  frequency: {
    type: String,
    enum: ['monthly', 'weekly', 'quarterly'],
    default: 'monthly',
  },
  sipDate: {
    type: Number, // Day of month (1, 5, 10, 15, 20, 25)
    required: true,
  },
  durationMonths: {
    type: Number,
    required: true,
    default: 12,
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
    required: true,
  },
  totalPlannedAmount: {
    type: Number,
    required: true,
  },
  totalPaidAmount: {
    type: Number,
    default: 0,
  },
  withdrawnAmount: {
    type: Number,
    default: 0,
  },
  totalContributions: {
    type: Number,
    required: true,
  },
  contributionsCompleted: {
    type: Number,
    default: 0,
  },
  remainingContributions: {
    type: Number,
    required: true,
  },
  nextContributionDate: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'cancelled'],
    default: 'active',
    index: true,
  },
  autoPayEnabled: {
    type: Boolean,
    default: false,
  },
  mandateId: {
    type: String,
  },
  notes: {
    type: String,
  },
}, { timestamps: true });

// Compound indexes for user listing and due processing
sipSchema.index({ userId: 1, createdAt: -1 });
sipSchema.index({ status: 1, nextContributionDate: 1 });

module.exports = mongoose.model('SIP', sipSchema);
