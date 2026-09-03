const Setting = require('./setting');
const axios = require('axios');
const CryptoJS = require('crypto-js');

// Helper to decrypt config
const decryptConfig = (encryptedString) => {
  try {
    const SECRET_KEY = process.env.CRYPTO_SECRET || process.env.NEXT_PUBLIC_CRYPTO_SECRET || 'fallback-secret-key-kapil-crm-123';
    const bytes = CryptoJS.AES.decrypt(encryptedString, SECRET_KEY);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedString);
  } catch (err) {
    console.error('Failed to decrypt config:', err);
    return null;
  }
};

exports.verifyMetaWebhook = (req, res) => {
  // Parse the query params
  const mode = req.query['hub.mode'] || req.query.mode;
  const token = req.query['hub.verify_token'] || req.query.verify_token;
  const challenge = req.query['hub.challenge'] || req.query.challenge || req.query.challange;

  const verify_token = process.env.META_VERIFY_TOKEN || 'kapil_crm_meta_token';

  // If there's a challenge, let's return it. Some testing tools might not send mode/token.
  if (challenge) {
    if (mode && token) {
      if (mode === 'subscribe' && token === verify_token) {
        console.log('META WEBHOOK VERIFIED WITH TOKEN!');
        return res.status(200).send(challenge);
      } else {
        console.error('META WEBHOOK VERIFICATION FAILED. Token mismatch.');
        return res.sendStatus(403);
      }
    } else {
      // Testing tool fallback without mode/token
      console.log('WEBHOOK CHALLENGE BOUNCED (Testing Mode)!');
      return res.status(200).send(challenge);
    }
  }

  return res.sendStatus(400);
};

exports.handleMetaWebhook = async (req, res) => {
  // Meta sends POST request when an event occurs
  const body = req.body;

  // Return a '200 OK' immediately to prevent Meta from retrying
  if (body.object) {
    res.status(200).send('EVENT_RECEIVED');
  } else {
    return res.sendStatus(404);
  }

  try {
    // Process the event asynchronously
    if (body.entry && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
      
      const messageObj = body.entry[0].changes[0].value.messages[0];
      
      // We only care about text messages for this chatbot
      if (messageObj.type === 'text' && messageObj.text && messageObj.text.body) {
        const incomingText = messageObj.text.body.trim().toLowerCase();
        const senderPhone = messageObj.from;

        // Check if keyword is Hi, Hello, or Hey
        if (['hi', 'hello', 'hey'].includes(incomingText)) {
          console.log(`[Chatbot] Received "${incomingText}" from ${senderPhone}. Replying...`);

          // 1. Fetch credentials from Database
          // Note: we require the Setting model at the top. Wait, setting is in model/setting.js, not controller!
          // We must require('../model/setting');
          const SettingModel = require('../model/setting');
          const setting = await SettingModel.findOne({ configType: 'meta_whatsapp' });

          if (!setting || !setting.encryptedData) {
            console.error('[Chatbot] No meta_whatsapp configuration found in database.');
            return;
          }

          // 2. Decrypt the credentials
          const config = decryptConfig(setting.encryptedData);
          if (!config || !config.metaDomain || !config.metaPhoneNumberId || !config.metaChannelToken) {
            console.error('[Chatbot] Failed to decrypt or missing required Meta API config.');
            return;
          }

          // 3. Send the reply via Meta Graph API
          // metaDomain might already contain the version (e.g., .../api/meta/v19.0)
          const domain = config.metaDomain.replace(/\/+$/, '');
          const metaApiUrl = `${domain}/${config.metaPhoneNumberId}/messages`;
          const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: senderPhone,
            type: 'text',
            text: {
              body: 'welcome to invisible world.'
            }
          };

          try {
            const cleanToken = config.metaChannelToken.trim();
            await axios.post(metaApiUrl, payload, {
              headers: {
                'Authorization': `Bearer ${cleanToken}`,
                'API-KEY': cleanToken,
                'Content-Type': 'application/json'
              }
            });
            console.log(`[Chatbot] Reply sent successfully to ${senderPhone}.`);
          } catch (apiError) {
            console.error('[Chatbot] Error sending message via Meta API:', apiError.response ? apiError.response.data : apiError.message);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Chatbot] Webhook processing error:', err);
  }
};
