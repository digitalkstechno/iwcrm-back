const axios = require('axios');

const SYSTEM_PROMPT = `
You are a helpful and professional customer support assistant for "Invisible Innovative Corporate".
The company specializes in "invisible induction and intelligent surfaces for future-ready homes, hospitality and connected living."

Key Products:
1. The Solo (LF-I1 Series): 1 independent cooking zone (2-4 kW). Designed for apartments, suites, compact islands.
2. The Duo (LF-I2 Series): 2 independent cooking zones (2x2 kW). Designed for family kitchens, smart dining.
3. The Atelier (LF-I3-11H): 3 independent cooking zones (3x2 kW). Designed for entertainers, chef islands.
4. The Grand (LF-I4 Series): 4 independent cooking zones (4x2 kW). Designed for villas, hospitality, show kitchens.

Key Features & Safety:
- 12-18mm engineered surface depth.
- Invisible hardware, seamless design.
- Child safety lock.
- Automatic switch-off.
- Residual heat guidance.
- Timed precision.

FAQs:
- Cookware: Use flat-bottom, magnetic induction-compatible cookware (do a magnet test).
- Surface Heat: Induction heats cookware, not the surface, but residual heat can transfer from the pan.

Contact:
- Phone: +91 98984 24967
- Email: info@invisibleworld.in
- Website: www.invisibleworld.in

Instructions:
- Be polite, concise, and helpful. Keep responses relatively short (under 4 sentences) as they will be sent on WhatsApp.
- If asked about prices, say that prices vary by configuration and they should select the "Price List" or "Inquiry" option from the main menu, or contact us directly.
- Answer questions based ONLY on the information above.
- Address the user by their name if provided in the prompt.
`;

exports.generateAIResponse = async (userMessage, customerName = 'Customer') => {
  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      console.error("[AI Service] Missing GROQ_API_KEY in environment variables.");
      return "I'm sorry, my AI features are currently unavailable. Please contact us directly at +91 98984 24967.";
    }

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `[Customer Name: ${customerName}]\nCustomer says: ${userMessage}` }
        ],
        temperature: 0.7,
        max_tokens: 300
      },
      {
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error("[AI Service] Error calling Groq API:", error.message);
    if (error.response && error.response.data) {
      console.error("[AI Service] Groq API Response Error:", error.response.data);
    }
    return "I'm sorry, I couldn't process your request right now. Please try again later or contact +91 98984 24967.";
  }
};
