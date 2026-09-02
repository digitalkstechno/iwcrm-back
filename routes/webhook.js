const express = require('express');
const router = express.Router();
const { verifyMetaWebhook, handleMetaWebhook } = require('../controller/webhook');

// Meta Webhook Verification (GET)
router.get('/meta', verifyMetaWebhook);

// Meta Webhook Event Receiver (POST)
router.post('/meta', handleMetaWebhook);

module.exports = router;
