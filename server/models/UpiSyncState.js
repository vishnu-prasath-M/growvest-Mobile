const mongoose = require('mongoose');

const upiSyncStateSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'default',
      unique: true,
      index: true,
    },
    lastUid: {
      type: Number,
      default: 0,
    },
    uidValidity: {
      type: Number,
      default: 0,
    },
    lastRun: {
      type: Date,
      default: null,
    },
    lastOk: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('UpiSyncState', upiSyncStateSchema);
