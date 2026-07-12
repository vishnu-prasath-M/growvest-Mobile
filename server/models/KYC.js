const mongoose = require('mongoose');

const kycSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  // Personal Details
  fullName: { type: String, required: true },
  fatherOrHusbandName: { type: String, required: true },
  dob: { type: Date, required: true },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  // Address
  address: { type: String, required: true },
  city: { type: String, required: true },
  district: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  // Identity
  aadhaarNumber: { type: String, required: true },
  panNumber: { type: String, required: true },
  occupation: { type: String, required: true },
  // Nominee
  nomineeName: { type: String, required: true },
  nomineeRelationship: { type: String, required: true },
  nomineeMobileNumber: { type: String, required: true },
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