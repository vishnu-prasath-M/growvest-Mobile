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
    
    console.log('[KYC Submit] User ID:', userId);
    console.log('[KYC Submit] Request body keys:', Object.keys(req.body));
    console.log('[KYC Submit] Body size:', JSON.stringify(req.body).length, 'bytes');
    
    // Check if KYC already exists
    const existingKYC = await KYC.findOne({ userId });
    if (existingKYC && existingKYC.status === 'approved') {
      return res.status(400).json({ message: 'KYC already approved' });
    }
    
    // Validate required text fields
    if (!req.body.fullName || !req.body.aadhaarNumber || !req.body.panNumber) {
      return res.status(400).json({ message: 'Missing required fields: fullName, aadhaarNumber, panNumber' });
    }
    
    const kycData = {
      userId,
      fullName: req.body.fullName || '',
      fatherOrHusbandName: req.body.fatherOrHusbandName || '',
      dob: req.body.dob ? new Date(req.body.dob) : null,
      gender: req.body.gender || '',
      address: req.body.address || '',
      city: req.body.city || '',
      district: req.body.district || '',
      state: req.body.state || '',
      pincode: req.body.pincode || '',
      aadhaarNumber: req.body.aadhaarNumber || '',
      panNumber: req.body.panNumber || '',
      occupation: req.body.occupation || '',
      nomineeName: req.body.nomineeName || '',
      nomineeRelationship: req.body.nomineeRelationship || '',
      nomineeMobileNumber: req.body.nomineeMobileNumber || '',
      accountHolderName: req.body.accountHolderName || '',
      bankName: req.body.bankName || '',
      accountNumber: req.body.accountNumber || '',
      confirmAccountNumber: req.body.confirmAccountNumber || '',
      ifscCode: req.body.ifscCode || '',
      branchName: req.body.branchName || '',
      upiId: req.body.upiId || '',
      // Store base64 images directly (they are already base64 strings from the app)
      aadhaarFrontImage: req.body.aadhaarFrontImage || '',
      aadhaarBackImage: req.body.aadhaarBackImage || '',
      panImage: req.body.panImage || '',
      profilePhoto: req.body.profilePhoto || '',
      status: 'pending',
      submittedAt: new Date(),
    };
    
    console.log('[KYC Submit] Creating/updating KYC record...');
    let kyc;
    if (existingKYC) {
      kyc = await KYC.findOneAndUpdate({ userId }, kycData, { new: true });
    } else {
      kyc = await KYC.create(kycData);
    }
    
    console.log('[KYC Submit] KYC saved successfully:', kyc._id);
    
    // Send notification using unified helper
    try {
      const { sendNotification, notifyAdmins } = require('../services/notificationHelper');
      await sendNotification({
        userId,
        title: 'KYC Submitted',
        description: 'Your KYC documents have been submitted successfully. We will review them shortly.',
        type: 'general',
      });
      await notifyAdmins({
        title: '📋 New KYC Submission',
        description: `${req.body.fullName} submitted KYC documents for verification.`,
        type: 'general',
        metadata: { kycId: kyc._id }
      });
    } catch (notifError) {
      console.warn('[KYC Submit] Failed to create notification:', notifError.message);
    }
    
    res.status(201).json(kyc);
  } catch (error) {
    console.error('[KYC Submit] Error:', error.message);
    console.error('[KYC Submit] Full error:', error);
    console.error('[KYC Submit] Stack:', error.stack);
    // Check for specific errors
    if (error.name === 'PayloadTooLargeError') {
      return res.status(413).json({ message: 'Request too large. Please reduce image sizes.' });
    }
    res.status(500).json({ message: error.message || 'Server error' });
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

// @desc    Get single KYC document image securely (Admin/Owner)
// @route   GET /api/kyc/document/:id/:docType
// @access  Private
exports.getKYCDocument = async (req, res) => {
  try {
    const { id, docType } = req.params;
    const jwt = require('jsonwebtoken');

    // Handle token from query string if not in header (for <img> src tags)
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, token missing' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    const requestor = await User.findById(decoded.id);

    if (!requestor) {
      return res.status(401).json({ message: 'Invalid authentication user' });
    }

    const kyc = await KYC.findById(id);
    if (!kyc) {
      return res.status(404).json({ message: 'KYC record not found' });
    }

    // Verify ownership or Admin role
    const isOwner = kyc.userId.toString() === requestor._id.toString();
    const isAdmin = requestor.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: Access to KYC document denied' });
    }

    let fieldMap = {
      aadhaarFront: kyc.aadhaarFrontImage,
      aadhaarBack: kyc.aadhaarBackImage,
      pan: kyc.panImage,
      profilePhoto: kyc.profilePhoto,
    };

    let docData = fieldMap[docType];
    if (!docData) {
      return res.status(404).json({ message: 'Document image not found' });
    }

    // If docData is an external URL, redirect
    if (docData.startsWith('http://') || docData.startsWith('https://')) {
      return res.redirect(docData);
    }

    // Determine MIME type and extract clean base64 data
    let mimeType = 'image/jpeg';
    let base64String = docData.trim();

    if (base64String.startsWith('data:')) {
      const parts = base64String.split(';');
      mimeType = parts[0].replace('data:', '') || 'image/jpeg';
      base64String = parts[1] ? parts[1].replace('base64,', '') : base64String;
    }

    // Clean any remaining prefixes or white spaces
    base64String = base64String.replace(/^data:image\/[a-z]+;base64,/, '').replace(/\s/g, '');

    const imgBuffer = Buffer.from(base64String, 'base64');

    if (!imgBuffer || imgBuffer.length === 0) {
      return res.status(404).json({ message: 'Corrupt or empty image buffer' });
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', imgBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(imgBuffer);
  } catch (error) {
    console.error('Error serving KYC document image:', error.message);
    return res.status(500).json({ message: 'Error serving document image' });
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
    
    // Send notification using unified helper
    const { sendNotification } = require('../services/notificationHelper');
    if (status === 'approved') {
      await sendNotification({
        userId: kyc.userId._id || kyc.userId,
        title: 'KYC Approved',
        description: 'Your KYC has been approved successfully. You can now access all features.',
        type: 'kyc_approved',
        pushData: { screen: 'KYC' },
      });
    } else {
      await sendNotification({
        userId: kyc.userId._id || kyc.userId,
        title: 'KYC Rejected',
        description: `Your KYC has been rejected. Reason: ${rejectionReason || 'Please resubmit with correct documents'}`,
        type: 'kyc_rejected',
        pushData: { screen: 'KYC' },
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

// @desc    Update bank details inside existing KYC record (single source of truth)
// @route   PUT /api/kyc/bank-details
// @access  Private
exports.updateBankDetails = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const {
      accountHolderName,
      bankName,
      accountNumber,
      ifscCode,
      branchName,
      upiId,
    } = req.body;

    // Basic validation
    if (!accountHolderName || !bankName || !accountNumber || !ifscCode || !branchName) {
      return res.status(400).json({ message: 'Required bank fields are missing' });
    }

    // Find existing KYC record for this user
    const existingKYC = await KYC.findOne({ userId });

    if (!existingKYC) {
      return res.status(404).json({ message: 'KYC record not found. Please complete KYC first.' });
    }

    // Update only bank-detail fields — preserves all other KYC data
    const updatedKYC = await KYC.findOneAndUpdate(
      { userId },
      {
        accountHolderName: accountHolderName.trim(),
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        confirmAccountNumber: accountNumber.trim(), // keep in sync
        ifscCode: ifscCode.trim().toUpperCase(),
        branchName: branchName.trim(),
        upiId: upiId ? upiId.trim() : '',
      },
      { new: true }
    );

    res.json({
      message: 'Bank details updated successfully',
      bankDetails: {
        accountHolderName: updatedKYC.accountHolderName,
        bankName: updatedKYC.bankName,
        accountNumber: updatedKYC.accountNumber,
        ifscCode: updatedKYC.ifscCode,
        branchName: updatedKYC.branchName,
        upiId: updatedKYC.upiId,
      },
    });
  } catch (error) {
    console.error('Error updating bank details:', error);
    res.status(500).json({ message: 'Server error' });
  }
};