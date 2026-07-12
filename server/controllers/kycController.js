const KYC = require('../models/KYC');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

// @desc    Submit KYC
// @route   POST /api/kyc/submit
// @access  Private
exports.submitKYC = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    
    // Check if KYC already exists
    const existingKYC = await KYC.findOne({ userId });
    if (existingKYC && existingKYC.status === 'approved') {
      return res.status(400).json({ message: 'KYC already approved' });
    }
    
    const kycData = {
      userId,
      fullName: req.body.fullName,
      fatherOrHusbandName: req.body.fatherOrHusbandName,
      dob: req.body.dob,
      gender: req.body.gender,
      address: req.body.address,
      city: req.body.city,
      district: req.body.district,
      state: req.body.state,
      pincode: req.body.pincode,
      aadhaarNumber: req.body.aadhaarNumber,
      panNumber: req.body.panNumber,
      occupation: req.body.occupation,
      nomineeName: req.body.nomineeName,
      nomineeRelationship: req.body.nomineeRelationship,
      nomineeMobileNumber: req.body.nomineeMobileNumber,
      accountHolderName: req.body.accountHolderName,
      bankName: req.body.bankName,
      accountNumber: req.body.accountNumber,
      confirmAccountNumber: req.body.confirmAccountNumber,
      ifscCode: req.body.ifscCode,
      branchName: req.body.branchName,
      upiId: req.body.upiId,
      aadhaarFrontImage: req.body.aadhaarFrontImage,
      aadhaarBackImage: req.body.aadhaarBackImage,
      panImage: req.body.panImage,
      profilePhoto: req.body.profilePhoto,
      status: 'pending',
      submittedAt: new Date(),
    };
    
    let kyc;
    if (existingKYC) {
      kyc = await KYC.findOneAndUpdate({ userId }, kycData, { new: true });
    } else {
      kyc = await KYC.create(kycData);
    }
    
    // Create notification for user
    const Notification = require('../models/Notification');
    await Notification.create({
      userId,
      title: 'KYC Submitted',
      description: 'Your KYC documents have been submitted successfully. We will review them shortly.',
      type: 'general',
      icon: 'shield-check',
    });
    
    res.status(201).json(kyc);
  } catch (error) {
    console.error('Error submitting KYC:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user's KYC status
// @route   GET /api/kyc/status
// @access  Private
exports.getKYCStatus = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const kyc = await KYC.findOne({ userId });
    
    if (!kyc) {
      return res.json({ status: 'not_submitted', message: 'KYC not submitted yet' });
    }
    
    res.json({
      status: kyc.status,
      rejectionReason: kyc.rejectionReason,
      submittedAt: kyc.submittedAt,
      hasKYC: true,
      data: kyc
    });
  } catch (error) {
    console.error('Error getting KYC status:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all KYC submissions (Admin)
// @route   GET /api/kyc/all
// @access  Private/Admin
exports.getAllKYC = async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = {};
    
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { panNumber: { $regex: search, $options: 'i' } },
        { aadhaarNumber: { $regex: search, $options: 'i' } },
      ];
    }
    
    const kycs = await KYC.find(query)
      .populate('userId', 'name username email mobileNumber')
      .sort({ submittedAt: -1 });
    
    res.json(kycs);
  } catch (error) {
    console.error('Error getting all KYC:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get single KYC detail (Admin)
// @route   GET /api/kyc/:id
// @access  Private/Admin
exports.getKYCDetail = async (req, res) => {
  try {
    const kyc = await KYC.findById(req.params.id)
      .populate('userId', 'name username email mobileNumber');
    
    if (!kyc) {
      return res.status(404).json({ message: 'KYC not found' });
    }
    
    res.json(kyc);
  } catch (error) {
    console.error('Error getting KYC detail:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Approve or Reject KYC (Admin)
// @route   PUT /api/kyc/:id/review
// @access  Private/Admin
exports.reviewKYC = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const adminId = req.user._id || req.user.id;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected' });
    }
    
    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }
    
    const kyc = await KYC.findByIdAndUpdate(
      req.params.id,
      {
        status,
        rejectionReason: rejectionReason || '',
        reviewedAt: new Date(),
        reviewedBy: adminId,
      },
      { new: true }
    ).populate('userId', 'name username email mobileNumber');
    
    if (!kyc) {
      return res.status(404).json({ message: 'KYC not found' });
    }
    
    // Create notification for user
    const Notification = require('../models/Notification');
    if (status === 'approved') {
      await Notification.create({
        userId: kyc.userId._id || kyc.userId,
        title: 'KYC Approved',
        description: 'Your KYC has been approved successfully. You can now access all features.',
        type: 'kyc_approved',
        icon: 'shield-check',
      });
    } else {
      await Notification.create({
        userId: kyc.userId._id || kyc.userId,
        title: 'KYC Rejected',
        description: `Your KYC has been rejected. Reason: ${rejectionReason || 'Please resubmit with correct documents'}`,
        type: 'kyc_rejected',
        icon: 'shield-off',
      });
    }
    
    res.json(kyc);
  } catch (error) {
    console.error('Error reviewing KYC:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get KYC stats (Admin)
// @route   GET /api/kyc/stats
// @access  Private/Admin
exports.getKYCStats = async (req, res) => {
  try {
    const [pending, approved, rejected] = await Promise.all([
      KYC.countDocuments({ status: 'pending' }),
      KYC.countDocuments({ status: 'approved' }),
      KYC.countDocuments({ status: 'rejected' }),
    ]);
    
    res.json({ pending, approved, rejected, total: pending + approved + rejected });
  } catch (error) {
    console.error('Error getting KYC stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
};