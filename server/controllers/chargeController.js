const PlatformCharge = require('../models/PlatformCharge');

// 1. PUBLIC: Get current effective platform charges (for mobile app & web)
exports.getCharges = async (req, res) => {
  try {
    const chargeDoc = await PlatformCharge.getSingleton();
    const effective = chargeDoc.getEffectiveCharges();
    res.status(200).json({
      success: true,
      charges: effective,
    });
  } catch (error) {
    console.error('[ChargeController] Get charges error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch platform charges', error: error.message });
  }
};

// 2. ADMIN: Get full raw charge configuration
exports.getAdminCharges = async (req, res) => {
  try {
    const chargeDoc = await PlatformCharge.getSingleton();
    res.status(200).json({
      success: true,
      charges: chargeDoc,
      effective: chargeDoc.getEffectiveCharges(),
    });
  } catch (error) {
    console.error('[ChargeController] Get admin charges error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch admin charges', error: error.message });
  }
};

// 3. ADMIN: Update platform charges & promotional toggle
exports.updateAdminCharges = async (req, res) => {
  try {
    const { isPromotionalLaunchOffer, promotionalNotice, chitFund, sip, investmentPlans } = req.body;
    let chargeDoc = await PlatformCharge.getSingleton();

    if (isPromotionalLaunchOffer !== undefined) {
      chargeDoc.isPromotionalLaunchOffer = Boolean(isPromotionalLaunchOffer);
    }

    if (promotionalNotice !== undefined) {
      chargeDoc.promotionalNotice = String(promotionalNotice).trim();
    }

    if (chitFund) {
      if (chitFund.processingCharge !== undefined) chargeDoc.chitFund.processingCharge = Number(chitFund.processingCharge) || 0;
      if (chitFund.maintenanceCharge !== undefined) chargeDoc.chitFund.maintenanceCharge = Number(chitFund.maintenanceCharge) || 0;
      if (chitFund.withdrawCommission !== undefined) chargeDoc.chitFund.withdrawCommission = Number(chitFund.withdrawCommission) || 0;
      if (chitFund.latePaymentPerDay !== undefined) chargeDoc.chitFund.latePaymentPerDay = Number(chitFund.latePaymentPerDay) || 0;
      if (chitFund.cancelPenalty !== undefined) chargeDoc.chitFund.cancelPenalty = Number(chitFund.cancelPenalty) || 0;
    }

    if (sip) {
      if (sip.processingCharge !== undefined) chargeDoc.sip.processingCharge = Number(sip.processingCharge) || 0;
      if (sip.maintenanceCharge !== undefined) chargeDoc.sip.maintenanceCharge = Number(sip.maintenanceCharge) || 0;
      if (sip.withdrawCommission !== undefined) chargeDoc.sip.withdrawCommission = Number(sip.withdrawCommission) || 0;
      if (sip.latePaymentPerDay !== undefined) chargeDoc.sip.latePaymentPerDay = Number(sip.latePaymentPerDay) || 0;
      if (sip.cancelPenalty !== undefined) chargeDoc.sip.cancelPenalty = Number(sip.cancelPenalty) || 0;
    }

    if (Array.isArray(investmentPlans) && investmentPlans.length > 0) {
      chargeDoc.investmentPlans = investmentPlans.map((p) => ({
        planName: p.planName || `${p.planReturnPercent}% Plan`,
        planReturnPercent: Number(p.planReturnPercent) || 0,
        durationDays: Number(p.durationDays) || 0,
        processingCharge: Number(p.processingCharge) || 0,
        maintenanceCharge: Number(p.maintenanceCharge) || 0,
        reason: p.reason || '',
      }));
    }

    chargeDoc.updatedBy = req.user?._id;
    await chargeDoc.save();

    res.status(200).json({
      success: true,
      message: 'Platform charges updated successfully!',
      charges: chargeDoc,
      effective: chargeDoc.getEffectiveCharges(),
    });
  } catch (error) {
    console.error('[ChargeController] Update charges error:', error);
    res.status(500).json({ success: false, message: 'Failed to update platform charges', error: error.message });
  }
};

