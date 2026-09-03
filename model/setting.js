const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema(
  {
    configType: {
      type: String,
      required: true,
      unique: true,
      default: 'meta_whatsapp'
    },
    metaDomain: String,
    metaPhoneNumberId: String,
    metaWabaId: String,
    metaChannelToken: String,
    metaVerifyToken: String
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', SettingSchema);
