const mongoose = require('mongoose');

const adBannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    linkUrl: {
      type: String,
      default: '',
      trim: true,
    },
    width: {
      type: Number,
      default: 1024,
    },
    height: {
      type: Number,
      default: 409,
    },
    aspectRatio: {
      type: Number,
      default: 2.50,
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

adBannerSchema.index({ isActive: 1, order: 1 });

module.exports = mongoose.model('AdBanner', adBannerSchema);

