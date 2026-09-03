const Setting = require('../model/setting');
const Lead = require('../model/lead');
const axios = require('axios');

// In-memory store for chat sessions
const chatSessions = new Map();

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
    if (body.entry && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value) {
      const value = body.entry[0].changes[0].value;

      // Log status updates (sent, delivered, read, failed)
      if (value.statuses && value.statuses.length > 0) {
        const statusObj = value.statuses[0];
        if (statusObj.status === 'failed') {
          console.error(`[Chatbot Webhook] Message FAILED for ${statusObj.recipient_id}. Reason:`, JSON.stringify(statusObj.errors, null, 2));
        } else {
          console.log(`[Chatbot Webhook] Message status: ${statusObj.status} for ${statusObj.recipient_id}`);
        }
      }

      if (value.messages && value.messages[0]) {
        const messageObj = value.messages[0];
      
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

        // Check if user is in an active session
        let session = chatSessions.get(senderPhone);

        if (session) {
          // User is in the middle of lead creation
          let replyText = '';
          if (session.step === 'NAME') {
            session.contactName = incomingText;
            session.step = 'COMPANY';
            replyText = `Thank you, ${incomingText}. Now, please reply with your *Company Name* (or type 'skip').`;
          } else if (session.step === 'COMPANY') {
            session.companyName = incomingText.toLowerCase() === 'skip' ? '' : incomingText;
            session.step = 'CITY';
            replyText = `Got it. Lastly, please reply with your *City*.`;
          } else if (session.step === 'CITY') {
            session.city = incomingText;
            
            // Save lead to DB
            try {
              const newLead = new Lead({
                contactName: session.contactName,
                companyName: session.companyName || 'Not Provided',
                city: session.city,
                phone: senderPhone
              });
              await newLead.save();
              console.log(`[Chatbot] Lead saved successfully for ${senderPhone}.`);
              replyText = `Thank you! Your details have been submitted successfully. Our team will contact you soon.`;
            } catch (err) {
              console.error('[Chatbot] Error saving lead:', err);
              replyText = `Oops, something went wrong while saving your details. Please try again later.`;
            }

            // Clear session
            chatSessions.delete(senderPhone);
          }

          // Send reply
          const domain = setting.metaDomain.replace(/\/+$/, '');
          const metaApiUrl = `${domain}/${setting.metaPhoneNumberId}/messages`;
          const cleanToken = setting.metaChannelToken.replace(/\s+/g, '');
          
          await axios.post(metaApiUrl, {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: senderPhone,
            type: 'text',
            text: { body: replyText }
          }, {
            headers: {
              'Authorization': `Bearer ${cleanToken}`,
              'Content-Type': 'application/json'
            }
          });

          return res.status(200).send('EVENT_RECEIVED');
        }

        const keywordsStr = setting.botKeywords || 'hi, hello, hey';
        const allowedKeywords = keywordsStr.split(',').map(k => k.trim().toLowerCase());

        if (allowedKeywords.includes(incomingText)) {
          console.log(`[Chatbot] Received "${incomingText}" from ${senderPhone}. Starting conversation...`);

          // Start a new session
          chatSessions.set(senderPhone, { step: 'NAME' });

          const domain = setting.metaDomain.replace(/\/+$/, '');
          const metaApiUrl = `${domain}/${setting.metaPhoneNumberId}/messages`;
          const cleanToken = setting.metaChannelToken.replace(/\s+/g, '');

          // Send initial greeting asking for name
          const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: senderPhone,
            type: 'text',
            text: {
              body: 'Welcome to Invisible World! To assist you better, please reply with your *Full Name*.'
            }
          };

          try {
            console.log(`[Chatbot] Sending POST to: ${metaApiUrl}`);
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
    }
  } catch (err) {
    console.error('[Chatbot] Webhook processing error:', err);
  }
};
