const mongoose = require('mongoose');

const chitSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  monthlyAmount: {
    type: Number,
    required: true,
  },
  weeklyAmount: {
    type: Number,
  },
  totalPot: {
    type: Number,
    required: true,
  },
  duration: {
    type: Number, // in weeks (if weekly) or months (if monthly)
    required: true,
  },
  totalMembers: {
    type: Number,
    required: true,
  },
  availableSlots: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['upcoming', 'active', 'completed', 'closed', 'paused', 'archived'],
    default: 'upcoming',
  },
  processingFee: {
    type: Number, // percentage e.g. 0
    default: 0,
  },
  startDate: {
    type: Date,
  },
  endDate: {
    type: Date,
  },
  features: {
    type: [String],
    default: [],
  },
  totalWeeks: {
    type: Number,
  },
  totalContribution: {
    type: Number,
  },
  paymentFrequency: {
    type: String,
    enum: ['weekly', 'monthly'],
    default: 'weekly',
  },
  paymentDay: {
    type: String,
    default: 'Sunday',
  },
  settlementWeek: {
    type: Number,
  },
  isWeekly: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// Index for fast status-based queries
chitSchema.index({ status: 1 });

module.exports = mongoose.model('Chit', chitSchema);

