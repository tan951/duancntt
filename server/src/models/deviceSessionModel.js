const mongoose = require('mongoose');

const DeviceSessionSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      index: true
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    startedAt: {
      type: Date,
      default: Date.now
    },

    endedAt: {
      type: Date,
      default: null
    },

    active: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Đảm bảo 1 device chỉ có 1 session active
DeviceSessionSchema.index(
  { deviceId: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } }
);

module.exports = mongoose.model('DeviceSession', DeviceSessionSchema);