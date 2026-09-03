/*  */exports.verifyMetaWebhook = (req, res) => {
  // Parse the query params
  const mode = req.query['hub.mode'] || req.query.mode;
  const token = req.query['hub.verify_token'] || req.query.verify_token;
  const challenge = req.query['hub.challenge'] || req.query.challenge || req.query.challange;

  // You can set this as an env variable or fetch from settings
  // For now we accept 'kapil_crm_secret_token' or any token if we want to be lenient, 
  // but Meta requires a match. Let's use a hardcoded fallback or what the user provides later.
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

exports.handleMetaWebhook = (req, res) => {
  // Meta sends POST request when an event occurs
  const body = req.body;

  console.log('Incoming Meta Webhook:', JSON.stringify(body, null, 2));

  // Check the Incoming webhook message
  if (body.object) {
    // Return a '200 OK' response to all requests
    return res.status(200).send('EVENT_RECEIVED');
  } else {
    // Return a '404 Not Found' if event is not from a WhatsApp API
    return res.sendStatus(404);
  }
};
