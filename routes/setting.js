const express = require('express');
const router = express.Router();
const { saveSettings, getSettings } = require('../controller/setting');

// @route   POST /v1/api/settings
// @desc    Save/Upsert Settings
router.post('/', saveSettings);

// @route   GET /v1/api/settings
// @desc    Get Settings
router.get('/', getSettings);

module.exports = router;
