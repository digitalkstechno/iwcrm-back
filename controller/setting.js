const Setting = require('../model/setting');

exports.saveSettings = async (req, res) => {
  try {
    const { configType, metaDomain, metaPhoneNumberId, metaWabaId, metaChannelToken, metaVerifyToken, botKeywords } = req.body;

    const type = configType || 'meta_whatsapp';

    const setting = await Setting.findOneAndUpdate(
      { configType: type },
      { metaDomain, metaPhoneNumberId, metaWabaId, metaChannelToken, metaVerifyToken, botKeywords },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      status: 'Success',
      message: 'Settings saved successfully',
      data: setting
    });
  } catch (error) {
    return res.status(500).json({ status: 'Fail', message: error.message });
  }
};

exports.getSettings = async (req, res) => {
  try {
    const type = req.query.configType || 'meta_whatsapp';
    const setting = await Setting.findOne({ configType: type });
    
    if (!setting) {
      return res.status(404).json({ status: 'Fail', message: 'Settings not found' });
    }

    return res.status(200).json({
      status: 'Success',
      message: 'Settings fetched successfully',
      data: setting
    });
  } catch (error) {
    return res.status(500).json({ status: 'Fail', message: error.message });
  }
};
