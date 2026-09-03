const Setting = require('../model/setting');
const Lead = require('../model/lead');
const axios = require('axios');

exports.verifyMetaWebhook = async (req, res) => {
  // Parse the query params
  const mode = req.query['hub.mode'] || req.query.mode;
  const token = req.query['hub.verify_token'] || req.query.verify_token;
  const challenge = req.query['hub.challenge'] || req.query.challenge || req.query.challange;

  let verify_token = process.env.META_VERIFY_TOKEN || 'kapil_crm_meta_token';
  
  // Try to fetch verify token from DB
  try {
    const setting = await Setting.findOne({ configType: 'meta_whatsapp' });
    if (setting && setting.metaVerifyToken) {
      verify_token = setting.metaVerifyToken;
    }
  } catch (err) {
    console.error('Error fetching verify token from DB', err);
  }

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

        // Check keywords from DB
        const setting = await Setting.findOne({ configType: 'meta_whatsapp' });

        if (!setting || !setting.metaDomain || !setting.metaPhoneNumberId || !setting.metaChannelToken) {
          console.error('[Chatbot] No valid meta_whatsapp configuration found in database.');
          return;
        }

        const keywordsStr = setting.botKeywords || 'hi, hello, hey';
        const allowedKeywords = keywordsStr.split(',').map(k => k.trim().toLowerCase());

        if (allowedKeywords.includes(incomingText)) {
          console.log(`[Chatbot] Received "${incomingText}" from ${senderPhone}. Replying...`);

          // 1. Fetch credentials from Database
          // 2. Prepare Meta API call
          const domain = setting.metaDomain.replace(/\/+$/, '');
          const metaApiUrl = `${domain}/${setting.metaPhoneNumberId}/messages`;
          
          let payload;
          if (setting.botFlowId) {
            // Send Flow Message
            payload = {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: senderPhone,
              type: 'interactive',
              interactive: {
                  type: 'flow',
                  header: { type: 'text', text: 'Lead Registration' },
                  body: { text: 'Welcome! Please fill out this short form so we can assist you better.' },
                  footer: { text: 'Powered by CRM' },
                  action: {
                      name: 'flow',
                      parameters: {
                          flow_message_version: '3',
                          flow_token: `lead_${senderPhone}_${Date.now()}`,
                          flow_id: setting.botFlowId,
                          flow_cta: 'Fill Form',
                          flow_action: 'navigate',
                          mode: 'published',
                          flow_action_payload: {
                              screen: 'LEAD_FORM'
                          }
                      }
                  }
              }
            };
          } else {
            // Fallback to text message
            payload = {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: senderPhone,
              type: 'text',
              text: {
                body: 'welcome to invisible world.'
              }
            };
          }

          try {
            // Remove all spaces and newlines completely from the token
            const cleanToken = setting.metaChannelToken.replace(/\s+/g, '');
            console.log(`[Chatbot] Sending POST to: ${metaApiUrl}`);
            console.log(`[Chatbot] Using Token: ${cleanToken.substring(0, 15)}... (Length: ${cleanToken.length})`);
            
            await axios.post(metaApiUrl, payload, {
              headers: {
                'Authorization': `Bearer ${cleanToken}`,
                'Content-Type': 'application/json'
              }
            });
            console.log(`[Chatbot] Reply sent successfully to ${senderPhone}.`);
          } catch (apiError) {
            console.error('[Chatbot] Error sending message via Meta API:', apiError.response ? apiError.response.data : apiError.message);
          }
        }
      } else if (messageObj.type === 'interactive' && messageObj.interactive && messageObj.interactive.type === 'nfm_reply') {
        // Handle Flow Submission
        try {
          const responseJson = JSON.parse(messageObj.interactive.nfm_reply.response_json);
          const { contactName, companyName, city } = responseJson;
          const senderPhone = messageObj.from;

          console.log(`[Chatbot] Received Flow Submission from ${senderPhone}:`, responseJson);

          // Save to Lead DB
          const newLead = new Lead({
            contactName: contactName || 'Unknown',
            companyName: companyName || '',
            city: city || 'Unknown',
            phone: senderPhone
          });
          await newLead.save();

          console.log(`[Chatbot] Lead saved successfully for ${senderPhone}.`);

          // Send Thank you message
          const setting = await Setting.findOne({ configType: 'meta_whatsapp' });
          if (setting && setting.metaDomain && setting.metaPhoneNumberId && setting.metaChannelToken) {
            const domain = setting.metaDomain.replace(/\/+$/, '');
            const metaApiUrl = `${domain}/${setting.metaPhoneNumberId}/messages`;
            const cleanToken = setting.metaChannelToken.replace(/\s+/g, '');
            
            await axios.post(metaApiUrl, {
              messaging_product: 'whatsapp',
              to: senderPhone,
              type: 'text',
              text: { body: 'Thank you! Your details have been submitted successfully.' }
            }, {
              headers: {
                'Authorization': `Bearer ${cleanToken}`,
                'Content-Type': 'application/json'
              }
            });
          }

        } catch (err) {
          console.error('[Chatbot] Error processing Flow Submission:', err);
        }
      }
    }
  } catch (err) {
    console.error('[Chatbot] Webhook processing error:', err);
  }
};
