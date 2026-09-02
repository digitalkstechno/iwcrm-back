const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema(
  {
    configType: {
      type: String,
      required: true,
      unique: true,
      default: 'meta_whatsapp'
    },
    encryptedData: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', SettingSchema);
