const express = require('express');
const router = express.Router();
const settingController = require('../controller/setting');
const flowController = require('../controller/flow');

// @route   POST /v1/api/settings
// @desc    Save/Upsert Settings
router.post('/', settingController.saveSettings);

// @route   GET /v1/api/settings
// @desc    Get Settings
router.get('/', settingController.getSettings);

// Flow generation route
router.post('/generate-flow', flowController.generateLeadFlow);

module.exports = router;
