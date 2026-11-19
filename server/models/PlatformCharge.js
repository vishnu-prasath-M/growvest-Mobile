const mongoose = require('mongoose');

const investmentTierChargeSchema = new mongoose.Schema({
  planName: { type: String, required: true },
  planReturnPercent: { type: Number, required: true },
  durationDays: { type: Number, required: true },
  processingCharge: { type: Number, default: 0.10 }, // in %
  maintenanceCharge: { type: Number, default: 0.02 }, // in %
  reason: { type: String, default: '' },
}, { _id: false });

const platformChargeSchema = new mongoose.Schema({
  // Global Launch Offer Mode: when true, all effective rates applied to users are 0%
  // Admin can toggle this off to apply the standard configured rates, or edit any rate.
  isPromotionalLaunchOffer: {
    type: Boolean,
    default: true, // Default to 0% commission for app launch as requested
  },
  promotionalNotice: {
    type: String,
    default: 'Special Launch Offer: 0% Platform Charges & Zero Commission Active!',
  },

  // Chit Fund Charges (Standard Config from PDF)
  chitFund: {
    processingCharge: { type: Number, default: 1.00 }, // 1.00%
    maintenanceCharge: { type: Number, default: 0.95 }, // 0.95%
    withdrawCommission: { type: Number, default: 1.95 }, // 1.95% total
    latePaymentPerDay: { type: Number, default: 2.35 }, // 2.35% per day
    cancelPenalty: { type: Number, default: 0 },
  },

  // SIP Charges (Standard Config from PDF)
  sip: {
    processingCharge: { type: Number, default: 1.00 }, // 1.00%
    maintenanceCharge: { type: Number, default: 0.95 }, // 0.95%
    withdrawCommission: { type: Number, default: 1.95 }, // 1.95% total
    latePaymentPerDay: { type: Number, default: 2.35 }, // 2.35% per day
    cancelPenalty: { type: Number, default: 15.00 }, // 15% cancel penalty from PDF
  },

  // Investment Plan Charges by Return Tier (from PDF)
  investmentPlans: {
    type: [investmentTierChargeSchema],
    default: [
      {
        planName: '6% Plan (Under 15 Days)',
        planReturnPercent: 6,
        durationDays: 7,
        processingCharge: 0.00,
        maintenanceCharge: 0.03,
        reason: 'Under 15 Days Maintanance Charges',
      },
      {
        planName: '12% Plan (15 Days)',
        planReturnPercent: 12,
        durationDays: 15,
        processingCharge: 0.10,
        maintenanceCharge: 0.02,
        reason: '15 Days Maintanance Charges',
      },
      {
        planName: '15% Plan (30 Days)',
        planReturnPercent: 15,
        durationDays: 30,
        processingCharge: 0.10,
        maintenanceCharge: 0.20,
        reason: '30 Days Maintanance Charges',
      },
      {
        planName: '18% Plan (90 Days)',
        planReturnPercent: 18,
        durationDays: 90,
        processingCharge: 0.10,
        maintenanceCharge: 0.62,
        reason: '90 Days Maintanance Charges',
      },
      {
        planName: '20% Plan (180 Days)',
        planReturnPercent: 20,
        durationDays: 180,
        processingCharge: 0.10,
        maintenanceCharge: 1.50,
        reason: '180 Days Maintanance Charges',
      },
      {
        planName: '24% Plan (365 Days)',
        planReturnPercent: 24,
        durationDays: 365,
        processingCharge: 0.10,
        maintenanceCharge: 2.78,
        reason: '365 Days Maintanance Charges',
      },
    ],
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

// Static helper to get or initialize the singleton configuration
platformChargeSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) {
    doc = await this.create({});
  }
  return doc;
};

// Method to compute effective charges (0% if launch offer active, otherwise configured rates)
platformChargeSchema.methods.getEffectiveCharges = function () {
  const isLaunch = this.isPromotionalLaunchOffer !== false;

  const effective = {
    isPromotionalLaunchOffer: isLaunch,
    promotionalNotice: this.promotionalNotice,
    chitFund: {
      processingCharge: isLaunch ? 0 : this.chitFund.processingCharge,
      maintenanceCharge: isLaunch ? 0 : this.chitFund.maintenanceCharge,
      withdrawCommission: isLaunch ? 0 : this.chitFund.withdrawCommission,
      latePaymentPerDay: isLaunch ? 0 : this.chitFund.latePaymentPerDay,
      cancelPenalty: isLaunch ? 0 : this.chitFund.cancelPenalty,
      standardRates: { ...this.chitFund.toObject?.() || this.chitFund },
    },
    sip: {
      processingCharge: isLaunch ? 0 : this.sip.processingCharge,
      maintenanceCharge: isLaunch ? 0 : this.sip.maintenanceCharge,
      withdrawCommission: isLaunch ? 0 : this.sip.withdrawCommission,
      latePaymentPerDay: isLaunch ? 0 : this.sip.latePaymentPerDay,
      cancelPenalty: isLaunch ? 0 : this.sip.cancelPenalty,
      standardRates: { ...this.sip.toObject?.() || this.sip },
    },
    investmentPlans: (this.investmentPlans || []).map((p) => ({
      planName: p.planName,
      planReturnPercent: p.planReturnPercent,
      durationDays: p.durationDays,
      processingCharge: isLaunch ? 0 : p.processingCharge,
      maintenanceCharge: isLaunch ? 0 : p.maintenanceCharge,
      reason: p.reason,
      standardRates: {
        processingCharge: p.processingCharge,
        maintenanceCharge: p.maintenanceCharge,
      },
    })),
  };

  return effective;
};

module.exports = mongoose.model('PlatformCharge', platformChargeSchema);
