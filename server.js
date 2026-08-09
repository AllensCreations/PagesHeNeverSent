import fs from 'fs';
if (fs.existsSync('.env')) { process.loadEnvFile('.env'); }

import http from 'http';
import { firebaseFetch, sendMessage, VERIFY_TOKEN, getDynamicQuickReplies, verifySignature } from './database.js';
import { renderAdminPanel } from './handlers/admin.js';
import { handlePaymentCommands } from './handlers/payments.js';
import { handleReaderCommands } from './handlers/reader.js';

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('Modular Messenger Bot Server Active');
  }

  if (req.method === 'GET' && url.pathname === '/webhook') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end(challenge);
    }
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  if (req.method === 'POST' && url.pathname === '/webhook') {
    let rawBody = '';
    req.on('data', chunk => { rawBody += chunk.toString(); });
    req.on('end', async () => {
      const signature = req.headers['x-hub-signature-256'];
      if (!verifySignature(rawBody, signature)) {
        console.warn('Rejected webhook call: invalid or missing signature');
        res.writeHead(403); return res.end();
      }

      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('EVENT_RECEIVED');

      try {
        const data = JSON.parse(rawBody);
        if (data.object === 'page') {
          for (const entry of data.entry) {
            if (!entry.messaging) continue;
            for (const event of entry.messaging) {
              const senderId = event.sender?.id;
              if (!senderId) continue;
              const input = event.message?.quick_reply?.payload ||
                            event.postback?.payload ||
                            event.message?.text || '';
              if (input.trim()) await handleMainRouter(senderId, input.trim());
            }
          }
        }
      } catch (e) {
        console.error('Webhook processing error:', e);
      }
    });
    return;
  }

  res.writeHead(404); res.end();
});

async function handleMainRouter(senderId, rawInput) {
  const input = rawInput.trim();
  const lowerInput = input.toLowerCase();

  let userData = await firebaseFetch(`users/${senderId}`);
  if (!userData) {
    userData = { role: 'user', rCoins: 50 };
    await firebaseFetch(`users/${senderId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userData)
    });
  }

  if (input === 'ADMIN_PANEL' || lowerInput === 'staff panel') {
    return renderAdminPanel(senderId);
  }

  if (await handlePaymentCommands(senderId, input, lowerInput, userData)) return;
  if (await handleReaderCommands(senderId, input, lowerInput, userData)) return;

  return sendMessage(senderId, {
    text: `Welcome to your Modular Messenger Bot Dashboard! 📊`,
    quick_replies: getDynamicQuickReplies('DASHBOARD', userData.role)
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
