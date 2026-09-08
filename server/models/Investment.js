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
    enum: ['pending', 'approved', 'rejected', 'withdrawn', 'reinvested'],
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
  planDurationDays: {
    type: Number,
  },
  planInterestRate: {
    type: Number,
  },
  durationDays: {
    type: Number,
  },
  eligibleHoldingDays: {
    type: Number,
  },
  applicableInterestTier: {
    type: String,
  },
  calculatedInterest: {
    type: Number,
  },
  totalInterest: {
    type: Number,
  },
  dailyInterest: {
    type: Number,
  },
  expectedPayout: {
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
    enum: ['locked', 'available', 'none', 'pending', 'withdrawn', 'reinvested'],
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
    default: 2, // 2 is correct authoritative tier calculation
  },
  // Date-based withdrawal & 5-week benefit eligibility fields
  selectedWithdrawalDate: {
    type: Date,
  },
  intendedWithdrawalDate: {
    type: Date,
  },
  eligibleHoldingDays: {
    type: Number,
  },
  applicableInterestRate: {
    type: Number,
  },
  applicableInterestTier: {
    type: String,
  },
  calculatedInterest: {
    type: Number,
  },
  expectedPayout: {
    type: Number,
  },
  planDurationDays: {
    type: Number,
  },
  planInterestRate: {
    type: Number,
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
    enum: ['early_principal_only', 'full_eligible', 'tier_eligible', 'withdrawn'],
    default: 'tier_eligible',
  },
  // Withdrawal request tracking — investment stays 'approved' until admin marks withdrawal as paid
  withdrawalRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Withdrawal',
    required: false,
  },
  // Reinvestment Tracking
  reinvestedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investment',
    required: false,
  },
  reinvestedInto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investment',
    required: false,
  },
  reinvestedAt: {
    type: Date,
  },
  // Payment Provider & Metadata
  paymentProvider: {
    type: String,
  },
  paymentStatus: {
    type: String,
  },
  paidAt: {
    type: Date,
  },
  verified: {
    type: Boolean,
  },
  orderId: {
    type: String,
  },
  paymentId: {
    type: String,
  },
  signature: {
    type: String,
  },
}, { timestamps: true });

// Index for fast user-based queries
investmentSchema.index({ userId: 1, status: 1 });
investmentSchema.index({ userEmail: 1 });

module.exports = mongoose.model('Investment', investmentSchema);