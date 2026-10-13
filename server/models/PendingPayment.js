const mongoose = require("mongoose");

/**
 * PendingPayment - stores order context at creation time so the webhook
 * can complete the business logic automatically when payment succeeds.
 */
const pendingPaymentSchema = new mongoose.Schema({
  orderId:     { type: String, required: true, unique: true, index: true },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  paymentType: { type: String, required: true },
  payloadData: { type: mongoose.Schema.Types.Mixed, default: {} },
  amount:      { type: Number },
  status:      { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
  completedAt: { type: Date },
  createdAt:   { type: Date, default: Date.now, expires: 60 * 60 * 24 },
});

module.exports = mongoose.model("PendingPayment", pendingPaymentSchema);
