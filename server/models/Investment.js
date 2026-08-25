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
    enum: ['saving', 'fixed', '15_days', '1_month', '3_months', '6_months', '1_year'],
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
  // Duration-based investment fields
  planType: {
    type: String,
  },
  durationDays: {
    type: Number,
  },
  totalInterest: {
    type: Number,
  },
  dailyInterest: {
    type: Number,
  },
  maturityAmount: {
    type: Number,
  },
  maturityDate: {
    type: Date,
  },
  withdrawalStatus: {
    type: String,
    enum: ['locked', 'available', 'withdrawn'],
    default: 'locked',
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
  },
  // Date-based withdrawal & 5-week benefit eligibility fields
  selectedWithdrawalDate: {
    type: Date,
  },
  benefitEligibilityDate: {
    type: Date,
  },
  benefits: {
    type: Number,
    default: 0,
  },
  fifthWeekPaymentCompleted: {
    type: Boolean,
    default: true,
  },
  eligibilityStatus: {
    type: String,
    enum: ['early_principal_only', 'full_eligible', 'withdrawn'],
    default: 'early_principal_only',
  }
}, { timestamps: true });

// Index for fast user-based queries
investmentSchema.index({ userId: 1, status: 1 });
investmentSchema.index({ userEmail: 1 });

module.exports = mongoose.model('Investment', investmentSchema);