const mongoose = require('mongoose');

const chitSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  monthlyAmount: {
    type: Number,
    required: true,
  },
  duration: {
    type: Number,
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
  totalPot: {
    type: Number,
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'upcoming', 'completed', 'closed'],
    default: 'active',
  },
  processingFee: {
    type: Number,
    default: 2.5,
  },
  features: [{
    type: String,
  }],
}, { timestamps: true });

module.exports = mongoose.model('Chit', chitSchema);