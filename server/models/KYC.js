const mongoose = require('mongoose');

const kycSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  // Personal Details
  fullName: { type: String },
  fatherOrHusbandName: { type: String },
  dob: { type: Date },
  gender: { type: String, enum: ['male', 'female', 'other'] },
  // Address
  address: { type: String },
  city: { type: String },
  district: { type: String },
  state: { type: String },
  pincode: { type: String },
  // Identity
  aadhaarNumber: { type: String },
  panNumber: { type: String },
  occupation: { type: String },
  // Nominee
  nomineeName: { type: String },
  nomineeRelationship: { type: String },
  nomineeMobileNumber: { type: String },
  // Bank Details
  accountHolderName: { type: String },
  bankName: { type: String },
  accountNumber: { type: String },
  confirmAccountNumber: { type: String },
  ifscCode: { type: String },
  branchName: { type: String },
  upiId: { type: String },
  // Images
  aadhaarFrontImage: { type: String },
  aadhaarBackImage: { type: String },
  panImage: { type: String },
  profilePhoto: { type: String },
  // Status
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rejectionReason: { type: String },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
  timestamps: true
});

module.exports = mongoose.model('KYC', kycSchema);