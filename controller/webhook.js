const Setting = require('../model/setting');
const Lead = require('../model/lead');
const { createLeadService } = require('../service/lead');
const { generateAIResponse } = require('../service/ai');
const axios = require('axios');

// In-memory store for chat sessions
const chatSessions = new Map();
const inactivityTimers = new Map();

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

        // Extract text or interactive list/button responses
        const senderPhone = messageObj.from;
        let incomingText = '';
        let customerName = 'there';
        if (value.contacts && value.contacts[0] && value.contacts[0].profile && value.contacts[0].profile.name) {
          customerName = value.contacts[0].profile.name;
        }

        if (messageObj.type === 'text' && messageObj.text && messageObj.text.body) {
          incomingText = messageObj.text.body.trim().toLowerCase();
        } else if (messageObj.type === 'interactive' && messageObj.interactive) {
          if (messageObj.interactive.type === 'list_reply') {
            incomingText = messageObj.interactive.list_reply.title.trim().toLowerCase();
          } else if (messageObj.interactive.type === 'button_reply') {
            incomingText = messageObj.interactive.button_reply.title.trim().toLowerCase();
          }
        } else if (['image', 'video', 'document', 'contacts', 'audio', 'location'].includes(messageObj.type)) {
          incomingText = 'media_attachment';
        }

        if (incomingText) {
          if (inactivityTimers.has(senderPhone)) {
            clearTimeout(inactivityTimers.get(senderPhone));
          }

          const timerId = setTimeout(async () => {
            inactivityTimers.delete(senderPhone);
            const currentSetting = await Setting.findOne({ configType: 'meta_whatsapp' });
            if (currentSetting && currentSetting.metaDomain && currentSetting.metaPhoneNumberId && currentSetting.metaChannelToken) {
              const domain = currentSetting.metaDomain.replace(/\/+$/, '');
              const metaApiUrl = `${domain}/${currentSetting.metaPhoneNumberId}/messages`;
              const cleanToken = currentSetting.metaChannelToken.replace(/\s+/g, '');
              try {
                await axios.post(metaApiUrl, {
                  messaging_product: 'whatsapp',
                  recipient_type: 'individual',
                  to: senderPhone,
                  type: 'interactive',
                  interactive: {
                    type: 'button',
                    body: { text: 'Appko invisible fan ke bare me mahiti hai ?' },
                    action: {
                      buttons: [
                        { type: 'reply', reply: { id: 'inv_fan_yes', title: 'Yes' } },
                        { type: 'reply', reply: { id: 'inv_fan_no', title: 'No' } }
                      ]
                    }
                  }
                }, { headers: { 'Authorization': `Bearer ${cleanToken}`, 'Content-Type': 'application/json' }});
                const s = chatSessions.get(senderPhone) || {};
                s.step = 'INVISIBLE_FAN_PROMO';
                chatSessions.set(senderPhone, s);
              } catch (e) { console.error('[Chatbot] Error sending promo:', e.message); }
            }
          }, 3600000); // 1 hour
          inactivityTimers.set(senderPhone, timerId);

          // Check keywords from DB
          const setting = await Setting.findOne({ configType: 'meta_whatsapp' });

          if (!setting || !setting.metaDomain || !setting.metaPhoneNumberId || !setting.metaChannelToken) {
            console.error('[Chatbot] No valid meta_whatsapp configuration found in database.');
            return;
          }

          // Helper function to send messages
          const sendMessage = async (messagePayload) => {
            const domain = setting.metaDomain.replace(/\/+$/, '');
            const metaApiUrl = `${domain}/${setting.metaPhoneNumberId}/messages`;
            const cleanToken = setting.metaChannelToken.replace(/\s+/g, '');

            try {
              await axios.post(metaApiUrl, {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: senderPhone,
                ...messagePayload
              }, {
                headers: {
                  'Authorization': `Bearer ${cleanToken}`,
                  'Content-Type': 'application/json'
                }
              });
            } catch (apiError) {
              console.error('[Chatbot] Error sending message via Meta API:', apiError.response ? apiError.response.data : apiError.message);
            }
          };

          const contactMsg = "If you’re interested in doing business with us, please share your visiting card or a short video of your showroom with us.";

          // Check if user is in an active session
          let session = chatSessions.get(senderPhone);

          if (session) {
            let replyText = '';
            if (session.step === 'ROLE_SELECTION') {
              if (incomingText === 'personal use' || incomingText === 'client') {
                session.role = 'Personal Use';
                session.step = 'CLIENT_OPTIONS';
                await sendMessage({
                  type: 'interactive',
                  interactive: {
                    type: 'button',
                    body: { text: 'Please choose an option to continue.\nVisit our website: www.invisibleworld.in' },
                    action: {
                      buttons: [
                        { type: 'reply', reply: { id: 'opt_catalog', title: 'Catalog' } },
                        { type: 'reply', reply: { id: 'opt_price_list', title: 'Price List' } },
                        { type: 'reply', reply: { id: 'opt_inquiry', title: 'Inquiry' } }
                      ]
                    }
                  }
                });
              } else if (incomingText === 'dealer') {
                session.role = incomingText;
                session.step = 'DEALER_OPTIONS';
                await sendMessage({
                  type: 'interactive',
                  interactive: {
                    type: 'button',
                    body: { text: 'Do you have a showroom or is this for personal use?' },
                    action: {
                      buttons: [
                        { type: 'reply', reply: { id: 'dealer_showroom', title: 'Showroom' } },
                        { type: 'reply', reply: { id: 'dealer_personal', title: 'Personal Use' } }
                      ]
                    }
                  }
                });
              } else if (incomingText === 'architect') {
                session.role = incomingText;
                session.step = 'NAME';
                replyText = `Please reply with your *Full Name*.`;
                await sendMessage({ type: 'text', text: { body: replyText } });
              } else {
                replyText = `Please select a valid role: Personal Use, Architect, or Dealer.`;
                await sendMessage({ type: 'text', text: { body: replyText } });
              }
            } else if (session.step === 'DEALER_OPTIONS') {
              if (incomingText === 'showroom') {
                replyText = `Please send your showroom details.\n\n📹 Showroom Video\n🪪 Visiting Card`;
                await sendMessage({ type: 'text', text: { body: replyText } });

                session.step = 'WAIT_SHOWROOM_DETAILS';
                session.timer = setTimeout(async () => {
                  const currentSession = chatSessions.get(senderPhone);
                  // Send unconditionally even if they responded
                  if (true) {
                    
                    // Send the 3 videos
                    const videos = [
                      "https://confidentialcontent.s3.eu-west-1.wasabisys.com/6a5de066a92cd55385a7c8e2/ac1c2641-cd57-4232-a610-fef22edcde27.mp4",
                      "https://confidentialcontent.s3.eu-west-1.wasabisys.com/6a5de066a92cd55385a7c8e2/5b4faa60-2a85-4000-add3-4cdd1eec1eed.mp4",
                      "https://confidentialcontent.s3.eu-west-1.wasabisys.com/6a5de066a92cd55385a7c8e2/c0a3b6f1-0bf1-4b0a-81c4-883d1651cca1.mp4"
                    ];
                    for (const url of videos) {
                      await sendMessage({ type: 'video', video: { link: url } });
                    }

                    // Send the price list
                    const priceListImages = [
                      "https://confidentialcontent.s3.eu-west-1.wasabisys.com/6a5de066a92cd55385a7c8e2/ae65cd31-852c-48f9-bb6f-cbec7e1ad139.jpg",
                      "https://confidentialcontent.s3.eu-west-1.wasabisys.com/6a5de066a92cd55385a7c8e2/d7601098-de22-4985-9c01-96d4335ccf87.jpg"
                    ];
                    for (const url of priceListImages) {
                      await sendMessage({ type: 'image', image: { link: url } });
                    }

                    // Send the catalog
                    await sendMessage({ type: 'document', document: { link: "https://confidentialcontent.s3.eu-west-1.wasabisys.com/6a5de066a92cd55385a7c8e2/3a73db26-014c-4a81-888b-31a9e4b96fc7.pdf", filename: "Catalog.pdf" } });

                    // Move to WAIT_AFTER_VIDEOS step if they haven't moved on
                    if (currentSession && currentSession.step === 'WAIT_SHOWROOM_DETAILS') {
                      currentSession.step = 'WAIT_AFTER_VIDEOS';
                    }
                    
                    // Second 10 seconds timer
                    const activeSession = chatSessions.get(senderPhone);
                    if (activeSession) {
                      activeSession.timer = setTimeout(async () => {
                        const s2 = chatSessions.get(senderPhone);
                        if (s2 && s2.step === 'WAIT_AFTER_VIDEOS') {
                        // Ask question
                        await sendMessage({
                          type: 'interactive',
                          interactive: {
                            type: 'button',
                            body: { text: 'Do you need the product for personal use?' },
                            action: {
                              buttons: [
                                { type: 'reply', reply: { id: 'rem_personal_yes', title: 'Yes' } },
                                { type: 'reply', reply: { id: 'rem_personal_no', title: 'No' } }
                              ]
                            }
                          }
                        });
                        s2.step = 'REMINDER_PERSONAL_USE';
                      }
                      }, 10000);
                    }
                  }
                }, 60000); // 1 minute wait
              } else if (incomingText === 'personal use') {
                session.step = 'NAME';
                replyText = `Please reply with your *Full Name*.`;
                await sendMessage({ type: 'text', text: { body: replyText } });
              } else {
                replyText = `Please select a valid option: Showroom or Personal Use.`;
                await sendMessage({ type: 'text', text: { body: replyText } });
              }
            } else if (session.step === 'WAIT_SHOWROOM_DETAILS' || session.step === 'WAIT_AFTER_VIDEOS') {
              if (session.timer) clearTimeout(session.timer);
              // Ask question
              await sendMessage({
                type: 'interactive',
                interactive: {
                  type: 'button',
                  body: { text: 'Do you need the product for personal use?' },
                  action: {
                    buttons: [
                      { type: 'reply', reply: { id: 'rem_personal_yes', title: 'Yes' } },
                      { type: 'reply', reply: { id: 'rem_personal_no', title: 'No' } }
                    ]
                  }
                }
              });
              session.step = 'REMINDER_PERSONAL_USE';
            } else if (session.step === 'REMINDER_PERSONAL_USE') {
              if (incomingText === 'yes') {
                session.step = 'PERSONAL_USE_CITY';
                replyText = `Please reply with your *City*.`;
                await sendMessage({ type: 'text', text: { body: replyText } });
              } else if (incomingText === 'no') {
                await sendMessage({
                  type: 'interactive',
                  interactive: {
                    type: 'button',
                    body: { text: 'Aap invisible world ki dushri product visit karna chaohoge ?' },
                    action: {
                      buttons: [
                        { type: 'reply', reply: { id: 'other_product_yes', title: 'Yes' } },
                        { type: 'reply', reply: { id: 'other_product_no', title: 'No' } }
                      ]
                    }
                  }
                });
                session.step = 'VISIT_OTHER_PRODUCT';
              } else {
                replyText = `Please select Yes or No.`;
                await sendMessage({ type: 'text', text: { body: replyText } });
              }
            } else if (session.step === 'VISIT_OTHER_PRODUCT') {
              if (incomingText === 'yes' || incomingText === 'no') {
                chatSessions.delete(senderPhone);
              } else {
                replyText = `Please select Yes or No.`;
                await sendMessage({ type: 'text', text: { body: replyText } });
              }
            } else if (session.step === 'INVISIBLE_FAN_PROMO') {
              if (incomingText === 'yes' || incomingText === 'no') {
                chatSessions.delete(senderPhone);
              } else {
                replyText = `Please select Yes or No.`;
                await sendMessage({ type: 'text', text: { body: replyText } });
              }
            } else if (session.step === 'PERSONAL_USE_CITY') {
              session.city = incomingText;
              // Create Inquiry Lead
              try {
                let processedPhone = senderPhone;
                if (processedPhone.startsWith('91') && processedPhone.length > 10) {
                  processedPhone = processedPhone.substring(2);
                }
                const leadData = {
                  contactName: customerName || 'Not Provided',
                  companyName: 'Not Provided',
                  city: session.city, // This triggers the matrix logic in leadService
                  phone: processedPhone,
                  role: 'Personal Use',
                  source: 'WhatsApp',
                  status: 'New'
                };
                await createLeadService(leadData);
                console.log(`[Chatbot] Inquiry Lead saved successfully for ${processedPhone} with city ${session.city}.`);
              } catch (err) {
                console.error('[Chatbot] Error saving lead:', err);
              }

              replyText = `Thank you! 👍\n\nYour inquiry has been submitted successfully.\nOur team will contact you shortly.`;
              await sendMessage({ type: 'text', text: { body: replyText } });
              chatSessions.delete(senderPhone);
            } else if (session.step === 'CLIENT_OPTIONS') {
              if (incomingText === 'catalog') {
                await sendMessage({ type: 'document', document: { link: "https://confidentialcontent.s3.eu-west-1.wasabisys.com/6a5de066a92cd55385a7c8e2/3a73db26-014c-4a81-888b-31a9e4b96fc7.pdf", filename: "Catalog.pdf" } });
                await sendMessage({ type: 'text', text: { body: contactMsg } });
                chatSessions.delete(senderPhone);
              } else if (incomingText === 'price list') {
                const images = [
                  "https://confidentialcontent.s3.eu-west-1.wasabisys.com/6a5de066a92cd55385a7c8e2/ae65cd31-852c-48f9-bb6f-cbec7e1ad139.jpg",
                  "https://confidentialcontent.s3.eu-west-1.wasabisys.com/6a5de066a92cd55385a7c8e2/d7601098-de22-4985-9c01-96d4335ccf87.jpg"
                ];
                for (const url of images) {
                  await sendMessage({ type: 'image', image: { link: url } });
                }
                await sendMessage({ type: 'text', text: { body: contactMsg } });
                chatSessions.delete(senderPhone);
              } else if (incomingText === 'inquiry') {
                session.step = 'NAME';
                replyText = `Please reply with your *Full Name*.`;
                await sendMessage({ type: 'text', text: { body: replyText } });
              } else {
                replyText = `Please choose a valid option: Video, Catalog, Price List, or Inquiry.`;
                await sendMessage({ type: 'text', text: { body: replyText } });
              }
            } else if (session.step === 'NAME') {
              session.contactName = incomingText;
              session.step = 'COMPANY';
              replyText = `Thank you, ${incomingText}. Now, please reply with your *Company Name* (or type 'skip').`;
              await sendMessage({ type: 'text', text: { body: replyText } });
            } else if (session.step === 'COMPANY') {
              session.companyName = incomingText.toLowerCase() === 'skip' ? '' : incomingText;
              session.step = 'CITY';
              replyText = `Got it. Lastly, please reply with your *City*.`;
              await sendMessage({ type: 'text', text: { body: replyText } });
            } else if (session.step === 'CITY') {
              session.city = incomingText;

              // Save lead to DB
              try {
                // Strip 91 from beginning of phone number if present and length > 10
                let processedPhone = senderPhone;
                if (processedPhone.startsWith('91') && processedPhone.length > 10) {
                  processedPhone = processedPhone.substring(2);
                }

                const leadData = {
                  contactName: session.contactName,
                  companyName: session.companyName || 'Not Provided',
                  city: session.city,
                  phone: processedPhone,
                  role: session.role || 'Client'
                };
                await createLeadService(leadData);
                console.log(`[Chatbot] Lead saved successfully for ${processedPhone}.`);
                replyText = `Thank you! Your details have been submitted successfully. Our team will contact you soon.`;
              } catch (err) {
                console.error('[Chatbot] Error saving lead:', err);
                replyText = `Oops, something went wrong while saving your details. Please try again later.`;
              }

              // Clear session
              chatSessions.delete(senderPhone);
              await sendMessage({ type: 'text', text: { body: replyText } });
            }

            return res.status(200).send('EVENT_RECEIVED');
          }

          const keywordsStr = setting.botKeywords || 'hi, hello, hey';
          const allowedKeywords = keywordsStr.split(',').map(k => k.trim().toLowerCase());

          if (allowedKeywords.includes(incomingText)) {
            console.log(`[Chatbot] Received "${incomingText}" from ${senderPhone}. Starting conversation...`);

            // Start a new session directly into WAIT_SHOWROOM_DETAILS
            chatSessions.set(senderPhone, { step: 'WAIT_SHOWROOM_DETAILS' });

            let replyText = `Please send your showroom details.\n\n📹 Showroom Video\n🪪 Visiting Card`;
            await sendMessage({ type: 'text', text: { body: replyText } });

            const currentSession = chatSessions.get(senderPhone);
            currentSession.timer = setTimeout(async () => {
              const checkSession = chatSessions.get(senderPhone);
              // Send unconditionally even if they responded
              if (true) {
                
                // Send the 3 videos
                const videos = [
                  "https://confidentialcontent.s3.eu-west-1.wasabisys.com/6a5de066a92cd55385a7c8e2/ac1c2641-cd57-4232-a610-fef22edcde27.mp4",
                  "https://confidentialcontent.s3.eu-west-1.wasabisys.com/6a5de066a92cd55385a7c8e2/5b4faa60-2a85-4000-add3-4cdd1eec1eed.mp4",
                  "https://confidentialcontent.s3.eu-west-1.wasabisys.com/6a5de066a92cd55385a7c8e2/c0a3b6f1-0bf1-4b0a-81c4-883d1651cca1.mp4"
                ];
                for (const url of videos) {
                  await sendMessage({ type: 'video', video: { link: url } });
                }

                // Send the price list
                const priceListImages = [
                  "https://confidentialcontent.s3.eu-west-1.wasabisys.com/6a5de066a92cd55385a7c8e2/ae65cd31-852c-48f9-bb6f-cbec7e1ad139.jpg",
                  "https://confidentialcontent.s3.eu-west-1.wasabisys.com/6a5de066a92cd55385a7c8e2/d7601098-de22-4985-9c01-96d4335ccf87.jpg"
                ];
                for (const url of priceListImages) {
                  await sendMessage({ type: 'image', image: { link: url } });
                }

                // Send the catalog
                await sendMessage({ type: 'document', document: { link: "https://confidentialcontent.s3.eu-west-1.wasabisys.com/6a5de066a92cd55385a7c8e2/3a73db26-014c-4a81-888b-31a9e4b96fc7.pdf", filename: "Catalog.pdf" } });

                // Move to WAIT_AFTER_VIDEOS step if they haven't moved on
                if (checkSession && checkSession.step === 'WAIT_SHOWROOM_DETAILS') {
                  checkSession.step = 'WAIT_AFTER_VIDEOS';
                }

                // Second 10 seconds timer
                const activeSession = chatSessions.get(senderPhone);
                if (activeSession) {
                  activeSession.timer = setTimeout(async () => {
                    const s2 = chatSessions.get(senderPhone);
                    if (s2 && s2.step === 'WAIT_AFTER_VIDEOS') {
                    // Ask question
                    await sendMessage({
                      type: 'interactive',
                      interactive: {
                        type: 'button',
                        body: { text: 'Do you need the product for personal use?' },
                        action: {
                          buttons: [
                            { type: 'reply', reply: { id: 'rem_personal_yes', title: 'Yes' } },
                            { type: 'reply', reply: { id: 'rem_personal_no', title: 'No' } }
                          ]
                        }
                      }
                    });
                    s2.step = 'REMINDER_PERSONAL_USE';
                  }
                }, 10000);
              }
            } // closes if (true)
          }, 60000); // 1 minute wait
          } else if (incomingText) {
            // If not a keyword and no active session, send it to AI
            console.log(`[Chatbot] Received general query from ${senderPhone}. Routing to AI...`);
            const aiResponse = await generateAIResponse(incomingText, customerName);
            await sendMessage({ type: 'text', text: { body: aiResponse } });
          }
        }

        if (messageObj.type === 'interactive' && messageObj.interactive && messageObj.interactive.type === 'nfm_reply') {
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
