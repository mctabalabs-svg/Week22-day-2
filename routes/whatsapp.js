const axios = require('axios');
const express = require('express');
const { handle } = require('../bot/chama-commands');

const router = express.Router();

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

async function sendMessage(to, text) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v22.0';
  if (!accessToken || !phoneNumberId) {
    throw new Error('WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID must be configured.');
  }

  await axios.post(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text },
    },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
}

router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

router.post('/webhook', async (req, res) => {
  try {
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        for (const message of value.messages || []) {
          if (!message.from || message.type !== 'text' || !message.text?.body) continue;

          const contact = (value.contacts || []).find((item) => item.wa_id === message.from);
          const reply = await handle(
            normalizePhone(message.from),
            message.text.body,
            contact?.profile?.name
          );
          await sendMessage(normalizePhone(message.from), reply);
        }
      }
    }
    return res.sendStatus(200);
  } catch (error) {
    console.error('WhatsApp webhook error:', error?.response?.data || error.message || error);
    return res.sendStatus(500);
  }
});

module.exports = router;
