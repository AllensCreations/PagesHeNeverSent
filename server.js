import fs from 'fs';

if (fs.existsSync('.env')) {
  process.loadEnvFile('.env');
}

import http from 'http';
import { seedData } from './messages.js';

const FIREBASE_URL = process.env.FIREBASE_URL ? process.env.FIREBASE_URL.replace(/\/$/, '') : '';
const FIREBASE_SECRET = process.env.FIREBASE_SECRET || '';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || '';
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'pages_he_never_sent_secret_123';

const userStates = new Map();
const STATE_TIMEOUT_MS = 15 * 60 * 1000;
const EMOJI_NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

const ANNOUNCEMENT_TIERS = [
  { id: 'TIER_1', title: '1 Day (100 Pts)', points: 100, days: 1 },
  { id: 'TIER_3', title: '3 Days (300 Pts)', points: 300, days: 3 },
  { id: 'TIER_7', title: '1 Week (500 Pts)', points: 500, days: 7 },
  { id: 'TIER_30', title: '1 Month (1000 Pts)', points: 1000, days: 30 }
];

const MOODS = [
  { id: 'MOOD_HEARTBREAK', label: '💔 Heartbreak' },
  { id: 'MOOD_KILIG', label: '🦋 Kilig' },
  { id: 'MOOD_APOLOGY', label: '🕯️ Unsent Apology' },
  { id: 'MOOD_CAMPUS', label: '🏫 Campus Memory' }
];

const REPORT_REASONS = ['Spam', 'Nudity', 'Hate Speech', 'Harassment', 'False Info'];

const BAD_WORDS = [
  'putangina', 'tangina', 'tanginamo', 'puta', 'gago', 'tanga', 'bobo', 'kupal', 
  'ulol', 'tarantado', 'kantot', 'puke', 'puki', 'titi', 'bayag', 'pepe', 'pokpok'
];

function containsBadWords(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return BAD_WORDS.some(word => lower.includes(word));
}

function isSpamOrGibberish(text) {
  if (!text || text.length < 25) return true;
  const words = text.split(/\s+/);
  if (words.length < 4) return true;
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  if (uniqueWords.size / words.length < 0.4) return true;
  return false;
}

function getUserState(senderId) {
  const state = userStates.get(senderId);
  if (!state) return null;
  if (Date.now() - state.lastUpdated > STATE_TIMEOUT_MS) {
    userStates.delete(senderId);
    return null;
  }
  return state;
}

function setUserState(senderId, stateObj) {
  userStates.set(senderId, { ...stateObj, lastUpdated: Date.now() });
}

function clearUserState(senderId) {
  userStates.delete(senderId);
}

function formatRatingDisplay(ratingSum, ratingCount) {
  if (!ratingCount || ratingCount === 0) {
    return 'Unrated';
  }
  return `${(ratingSum / ratingCount).toFixed(1)} ⭐ (${ratingCount})`;
}

function getStreakBadge(streak) {
  if (streak >= 30) return '🥇 30-Day Keeper';
  if (streak >= 7) return '🥈 7-Day Hopeless Romantic';
  if (streak >= 3) return '🥉 3-Day Reader';
  return '🌱 Novice Reader';
}

function mapMoodToKey(rawMood) {
  if (!rawMood) return 'MOOD_HEARTBREAK';
  const m = rawMood.toLowerCase();
  if (m.includes('kilig') || m.includes('🦋')) return 'MOOD_KILIG';
  if (m.includes('apology') || m.includes('🕯️')) return 'MOOD_APOLOGY';
  if (m.includes('campus') || m.includes('🏫')) return 'MOOD_CAMPUS';
  return 'MOOD_HEARTBREAK';
}

function parseCSV(text) {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const results = [];

  for (let line of lines) {
    if (line.toLowerCase().startsWith('name,title,body')) continue;

    const row = [];
    let insideQuotes = false;
    let currentField = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        row.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    row.push(currentField.trim());

    if (row.length >= 3) {
      results.push({
        name: row[0],
        title: row[1],
        body: row[2],
        mood: mapMoodToKey(row[3] || '')
      });
    }
  }
  return results;
}

function toBoldUnicode(str) {
  const map = {
    A: '𝗔', B: '𝗕', C: '𝗖', D: '𝗗', E: '𝗘', F: '𝗙', G: '𝗚', H: '𝗛', I: '𝗜', J: '𝗝', K: '𝗞', L: '𝗟', M: '𝗠', N: '𝗡', O: '𝗢', P: '𝗣', Q: '𝗤', R: '𝗥', S: '𝗦', T: '𝗧', U: '𝗨', V: '𝗩', W: '𝗪', X: '𝗫', Y: '𝗬', Z: '𝗭',
    a: '𝗮', b: '𝗯', c: '𝗰', d: '𝗱', e: '𝗲', f: '𝗳', g: '𝗴', h: '𝗵', i: '𝗶', j: '𝗷', k: '𝗸', l: '𝗹', m: '𝗺', n: '𝗻', o: '𝗼', p: '𝗽', q: '𝗾', r: '𝗿', s: '𝘀', t: '𝘁', u: '𝘂', v: '𝘃', w: '𝘄', x: '𝘅', y: '𝘆', z: '𝘇',
    '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵'
  };
  return str.split('').map(char => map[char] || char).join('');
}

function toItalicUnicode(str) {
  const map = {
    A: '𝐴', B: '𝐵', C: '𝐶', D: '𝐷', E: '𝐸', F: '𝐹', G: '𝐺', H: '𝐻', I: '𝐼', J: '𝐽', K: '𝐾', L: '𝐿', M: '𝑀', N: '𝑁', O: '𝑂', P: '𝑃', Q: '𝑄', R: '𝑅', S: '𝑆', T: '𝑇', U: '𝑈', V: '𝑉', W: '𝑊', X: '𝑋', Y: '𝑌', Z: '𝑍',
    a: '𝑎', b: '𝑏', c: '𝑐', d: '𝑑', e: '𝑒', f: '𝑓', g: '𝑔', h: 'ℎ', i: '𝑖', j: '𝑗', k: '𝑘', l: '𝑙', m: '𝑚', n: '𝑛', o: '𝑜', p: '𝑝', q: '𝑞', r: '𝑟', s: '𝑠', t: '𝑡', u: '𝑢', v: '𝑣', w: '𝑤', x: '𝑥', y: '𝑦', z: '𝑧'
  };
  return str.split('').map(char => map[char] || char).join('');
}

async function firebaseFetch(path, options = {}) {
  if (!FIREBASE_URL || !FIREBASE_SECRET) return null;
  const url = `${FIREBASE_URL}/${path}.json?auth=${FIREBASE_SECRET}`;
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`Firebase status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Firebase Error:', err);
    return null;
  }
}

async function sendSenderAction(recipientId, action = 'typing_on') {
  if (!PAGE_ACCESS_TOKEN) return;
  try {
    await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        sender_action: action
      })
    });
  } catch (err) {
    console.error('Sender Action Error:', err);
  }
}

async function sendMessage(recipientId, payload) {
  if (!PAGE_ACCESS_TOKEN) return;
  await sendSenderAction(recipientId, 'typing_off');
  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: payload
      })
    });
    const data = await res.json();
    if (data.error) console.error('Meta API Error:', JSON.stringify(data.error));
  } catch (err) {
    console.error('Outbound Delivery Error:', err);
  }
}

function generateReferralCode() {
  return '#' + Math.random().toString(36).substring(2, 5).toUpperCase() + Math.floor(100 + Math.random() * 900);
}

async function ensureUser(senderId) {
  let user = await firebaseFetch(`users/${senderId}`);
  const todayStr = new Date().toISOString().split('T')[0];

  if (!user) {
    user = {
      role: 'user',
      rCoins: 50,
      isVIP: false,
      vipLevel: 0,
      vip2AutoClaimed: false,
      streak: 0,
      messagesToday: 0,
      lastWriteDate: todayStr,
      lastCheckinDate: '',
      userCode: generateReferralCode(),
      acceptedTC: false,
      redeemedReferral: false,
      ratedMsgs: {},
      createdAt: Date.now()
    };
    await firebaseFetch(`users/${senderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
  } else {
    let updates = {};
    if (user.lastWriteDate !== todayStr) {
      user.messagesToday = 0;
      user.lastWriteDate = todayStr;
      updates.messagesToday = 0;
      updates.lastWriteDate = todayStr;
    }

    if (user.lastCheckinDate !== todayStr) {
      let dailyAdd = 50;
      if (user.vipLevel === 2) dailyAdd = 200;
      user.rCoins = (user.rCoins || 0) + dailyAdd;
      user.lastCheckinDate = todayStr;
      updates.rCoins = user.rCoins;
      updates.lastCheckinDate = todayStr;
    }

    if (Object.keys(updates).length > 0) {
      await firebaseFetch(`users/${senderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    }
  }
  return user;
}

async function checkReadingQuota(senderId, user) {
  if ((user.rCoins || 0) >= 10) {
    const newCoins = user.rCoins - 10;
    await firebaseFetch(`users/${senderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rCoins: newCoins })
    });
    return { allowed: true, remainingPoints: newCoins };
  } else {
    return { allowed: false };
  }
}

function getDynamicQuickReplies(activeContext, role = 'user') {
  const allReplies = [
    { id: 'RANDOM', content_type: 'text', title: '📜 Random Page', payload: '/random' },
    { id: 'SEARCH', content_type: 'text', title: '🔍 Search Name', payload: '/search' },
    { id: 'LEAVE', content_type: 'text', title: '💬 Leave Message', payload: '/message' },
    { id: 'OCCASION', content_type: 'text', title: '📅 Search Occasion', payload: 'SEARCH_OCCASION_START' },
    { id: 'TRENDING', content_type: 'text', title: '🔥 Trending Pages', payload: '/trending' },
    { id: 'MOODS', content_type: 'text', title: '🎭 Browse Moods', payload: 'BROWSE_MOODS' },
    { id: 'SUB_ANNOUNCE', content_type: 'text', title: '📣 Promote Post', payload: 'PROMOTED_ANNOUNCE_MENU' },
    { id: 'VIP', content_type: 'text', title: '🌟 Upgrade to VIP', payload: 'VIP_UPGRADE_MENU' },
    { id: 'CHANGELOG', content_type: 'text', title: '📜 Changelog', payload: 'CHANGELOG_VIEW' },
    { id: 'DASHBOARD', content_type: 'text', title: '📊 My Dashboard', payload: 'USER_DASHBOARD' }
  ];

  if (role === 'admin' || role === 'moderator') {
    allReplies.unshift({ id: 'STAFF', content_type: 'text', title: '📢 Staff Panel', payload: 'ADMIN_PANEL' });
  }

  return allReplies.filter(r => r.id !== activeContext).slice(0, 10).map(({ content_type, title, payload }) => ({ content_type, title, payload }));
}

async function getActiveSubAnnouncements() {
  const subAnnData = await firebaseFetch('sub_announcements') || {};
  const now = Date.now();

  const allApproved = Object.entries(subAnnData)
    .map(([id, val]) => ({ id, ...val }))
    .filter(a => a.status === 'APPROVED');

  const active = [];
  const queued = [];

  for (const item of allApproved) {
    if (item.expiresAt && item.expiresAt <= now) {
      await firebaseFetch(`sub_announcements/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'EXPIRED' })
      });
      continue;
    }

    if (item.expiresAt && item.expiresAt > now && item.activatedAt && item.activatedAt <= now) {
      active.push(item);
    } else if (!item.activatedAt || item.activatedAt > now) {
      queued.push(item);
    }
  }

  active.sort((a, b) => a.activatedAt - b.activatedAt);
  queued.sort((a, b) => a.createdAt - b.createdAt);

  while (active.length < 3 && queued.length > 0) {
    const nextItem = queued.shift();
    const durationMs = nextItem.days * 24 * 60 * 60 * 1000;
    const activatedAt = now;
    const expiresAt = now + durationMs;

    await firebaseFetch(`sub_announcements/${nextItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activatedAt, expiresAt })
    });

    nextItem.activatedAt = activatedAt;
    nextItem.expiresAt = expiresAt;
    active.push(nextItem);
  }

  return { active: active.slice(0, 3), queued };
}

async function registerPersistentMenu() {
  if (!PAGE_ACCESS_TOKEN) return;
  try {
    await fetch(`https://graph.facebook.com/v18.0/me/messenger_profile?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persistent_menu: [
          {
            locale: 'default',
            composer_input_disabled: false,
            call_to_actions: [
              { type: 'postback', title: '📜 Random Page', payload: '/random' },
              { type: 'postback', title: '🔍 Search Name', payload: '/search' },
              { type: 'postback', title: '💬 Leave Message', payload: '/message' },
              { type: 'postback', title: '📊 My Dashboard', payload: 'USER_DASHBOARD' }
            ]
          }
        ]
      })
    });
    console.log('Persistent Menu registered successfully!');
  } catch (err) {
    console.error('Persistent Menu Registration Error:', err);
  }
}

async function autoSeedDataOnStartup() {
  if (!Array.isArray(seedData) || seedData.length === 0) return;
  const existingMsgs = await firebaseFetch('messages') || {};
  const existingTitles = new Set(Object.values(existingMsgs).map(m => m.title?.toLowerCase().trim()));

  for (const item of seedData) {
    const itemTitleKey = item.title?.toLowerCase().trim();
    if (!existingTitles.has(itemTitleKey)) {
      await firebaseFetch('messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetName: item.name.toLowerCase(),
          displayName: item.name,
          title: item.title,
          body: item.body,
          author: 'Anonymous',
          authorCode: '#SYS999',
          ratingSum: 15,
          ratingCount: 3,
          reportCount: 0,
          createdAt: Date.now()
        })
      });
      existingTitles.add(itemTitleKey);
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('Pages He Never Sent — Active');
  }

  if (req.method === 'GET' && url.pathname === '/webhook') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end(challenge);
    } else {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Forbidden');
    }
  }

  if (req.method === 'POST' && url.pathname === '/webhook') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('EVENT_RECEIVED');

    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        if (data.object === 'page') {
          for (const entry of data.entry) {
            if (!entry.messaging) continue;
            for (const event of entry.messaging) {
              const senderId = event.sender?.id;
              if (!senderId) continue;

              const input = event.message?.quick_reply?.payload ||
                            event.postback?.payload ||
                            event.message?.text || '';

              if (input.trim()) {
                await handleCommand(senderId, input.trim());
              }
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

async function handleCommand(senderId, rawInput) {
  let input = rawInput.trim();

  if (input.includes('@Meta AI')) {
    input = input.replace('@Meta AI', '').trim();
  }

  if (input === '👍🏻' || input === '👍') {
    const userData = await ensureUser(senderId);
    return sendDashboard(senderId, userData);
  }

  const lowerInput = input.toLowerCase();
  const currentState = getUserState(senderId);
  const userData = await ensureUser(senderId);

  if (!userData.acceptedTC) {
    if (input === 'ACCEPT_TC') {
      await firebaseFetch(`users/${senderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acceptedTC: true })
      });
      const refreshedUser = await ensureUser(senderId);
      return sendDashboard(senderId, refreshedUser);
    }

    return sendMessage(senderId, {
      text: `📜 TERMS & CONDITIONS & DPA PRIVACY NOTICE\n\nWelcome to Pages He Never Sent!\n\n• By using this bot, you acknowledge that every message or letter you leave becomes a permanent collection in our database and CANNOT be undone.\n• You will receive minimal platform notifications.\n• Data Privacy Act (DPA) compliance: All confessions are stored anonymously with unique user tracking codes for moderation purposes.\n\nTap below to agree and enter the sanctuary:`,
      quick_replies: [
        { content_type: 'text', title: '✅ I Agree & Enter', payload: 'ACCEPT_TC' }
      ]
    });
  }

  if (input === 'CANCEL_ACTION' || lowerInput === '❌ cancel' || lowerInput === 'cancel') {
    clearUserState(senderId);
    return sendDashboard(senderId, userData);
  }

  if (input === 'GET_STARTED' || lowerInput === 'get started' || lowerInput === 'hi' || lowerInput === 'hello' || lowerInput === 'menu') {
    clearUserState(senderId);
    return sendDashboard(senderId, userData);
  }

  if (input === 'CHANGELOG_VIEW' || lowerInput === '📜 changelog') {
    clearUserState(senderId);
    return sendMessage(senderId, {
      text: `📜 PLATFORM CHANGELOG (v2.9)\n\n• Restored Persistent Menu integration.\n• Enhanced pagination controls (Max 5 items per page).`,
      quick_replies: getDynamicQuickReplies('CHANGELOG', userData.role)
    });
  }

  if (input === 'ADMIN_PANEL' || lowerInput === '📢 staff panel') {
    clearUserState(senderId);
    if (userData.role !== 'admin' && userData.role !== 'moderator') return sendDashboard(senderId, userData);
    return renderAdminPanel(senderId, userData);
  }

  if (input === 'VIEW_STATS') {
    if (userData.role !== 'admin' && userData.role !== 'moderator') return sendDashboard(senderId, userData);
    return renderAdminPanel(senderId, userData);
  }

  if (input === 'VIEW_PENDING_PAYMENTS') {
    if (userData.role !== 'admin') return sendDashboard(senderId, userData);

    const pendingPayments = await firebaseFetch('pending_payments') || {};
    const entries = Object.entries(pendingPayments);

    if (entries.length === 0) {
      await sendMessage(senderId, { text: `💳 PENDING PAYMENTS\n\nThere are currently no pending GCash payments to review.` });
      return renderAdminPanel(senderId, userData);
    }

    const [payKey, currentPay] = entries[0];
    return sendMessage(senderId, {
      text: `💳 PENDING PAYMENT REVIEW (1 of ${entries.length})\n\nUser ID: ${currentPay.senderId}\nPayment Code: ${currentPay.payRef}\nGCash Ref #: ${currentPay.gcashRef}\nSubmitted: ${new Date(currentPay.timestamp).toLocaleString()}\n\nSelect an action below:`,
      quick_replies: [
        { content_type: 'text', title: '✅ Accept 500 Pts + VIP', payload: `ACCEPT_BUY_${currentPay.senderId}_500_${payKey}` },
        { content_type: 'text', title: '❌ Reject', payload: `REJECT_BUY_${currentPay.senderId}_${payKey}` },
        { content_type: 'text', title: '📢 Staff Panel', payload: 'ADMIN_PANEL' }
      ]
    });
  }

  if (input === 'REVIEW_SUB_ANNOUNCEMENTS') {
    if (userData.role !== 'admin' && userData.role !== 'moderator') return sendDashboard(senderId, userData);

    const subAnnObj = await firebaseFetch('sub_announcements') || {};
    const pendingList = Object.entries(subAnnObj)
      .map(([id, val]) => ({ id, ...val }))
      .filter(a => a.status === 'PENDING_APPROVAL');

    if (pendingList.length === 0) {
      await sendMessage(senderId, { text: '🛡️ No pending SubAnnouncements to review.' });
      return renderAdminPanel(senderId, userData);
    }

    const current = pendingList[0];
    return sendMessage(senderId, {
      text: `📣 PENDING SUB-ANNOUNCEMENT (1 of ${pendingList.length})\n\nSubAnn ID: ${current.id}\nUser ID: ${current.senderId}\nPoints Paid: ${current.points} (${current.days} Days)\nText: "${current.text}"\n\nSelect action below:`,
      quick_replies: [
        { content_type: 'text', title: '✅ Approve', payload: `APPROVE_SUBANN_${current.id}` },
        { content_type: 'text', title: '❌ Reject & Refund', payload: `REJECT_SUBANN_START_${current.id}` },
        { content_type: 'text', title: '📢 Staff Panel', payload: 'ADMIN_PANEL' }
      ]
    });
  }

  if (input === 'STAFF_REPORTS' || lowerInput === '/reports') {
    if (userData.role !== 'admin' && userData.role !== 'moderator') return sendDashboard(senderId, userData);
    return sendNextReport(senderId, userData);
  }

  if (lowerInput.startsWith('/admin 159266 viplock')) {
    clearUserState(senderId);
    if (userData.role !== 'admin') return sendDashboard(senderId, userData);
    const settings = await firebaseFetch('settings') || {};
    const newLockState = !settings.vipLocked;
    await firebaseFetch('settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vipLocked: newLockState })
    });
    return sendMessage(senderId, {
      text: `🔒 VIP PURCHASING STATUS UPDATED\n\nVIP Lock is now: ${newLockState ? 'LOCKED' : 'UNLOCKED'}`,
      quick_replies: [{ content_type: 'text', title: '📢 Staff Panel', payload: 'ADMIN_PANEL' }]
    });
  }

  if (input === 'VIP_UPGRADE_MENU' || lowerInput === '🌟 upgrade to vip' || lowerInput === 'buy vip') {
    clearUserState(senderId);
    const settings = await firebaseFetch('settings') || {};
    if (settings.vipLocked) {
      return sendMessage(senderId, {
        text: `🔒 VIP PURCHASING TEMPORARILY UNAVAILABLE`,
        quick_replies: getDynamicQuickReplies('DASHBOARD', userData.role)
      });
    }

    if (userData.vipLevel === 2) {
      return sendMessage(senderId, {
        text: `🌟 VIP STATUS ACTIVE\n\nYou already own VIP Level 1 and VIP Level 2!`,
        quick_replies: getDynamicQuickReplies('DASHBOARD', userData.role)
      });
    }

    if (userData.vipLevel === 1) {
      setUserState(senderId, { step: 'WAITING_VIP_LEVEL_2_REF' });
      return sendMessage(senderId, {
        text: `🌟 UPGRADE TO VIP LEVEL 2 (₱49 — One-Time Payment)\n\n• Automatic Daily Rewards Claim!\n\nSend ₱49.00 via GCash:\n📱 GCash #: 09658110032\n👤 Name: Mr. Salviejo\n\nReply below with your 13-digit GCash Reference Number:`,
        quick_replies: [{ content_type: 'text', title: '❌ Cancel', payload: 'CANCEL_ACTION' }]
      });
    }

    setUserState(senderId, { step: 'WAITING_VIP_LEVEL_1_REF' });
    return sendMessage(senderId, {
      text: `🌟 UPGRADE TO VIP LEVEL 1 (₱99 — One-Time Payment)\n\n• VIP Perks: Earn 100 Points daily upon check-in!\n\nSend ₱99.00 via GCash:\n📱 GCash #: 09658110032\n👤 Name: Mr. Salviejo\n\nReply below with your 13-digit GCash Reference Number:`,
      quick_replies: [{ content_type: 'text', title: '❌ Cancel', payload: 'CANCEL_ACTION' }]
    });
  }

  if (currentState?.step === 'WAITING_VIP_LEVEL_1_REF') {
    clearUserState(senderId);
    const gcashRef = input.trim();
    const payRef = 'VIP1-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    const newPayment = { senderId, payRef, gcashRef, vipTier: 1, timestamp: Date.now() };
    const payRes = await firebaseFetch('pending_payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPayment)
    });
    const payKey = payRes?.name || '';

    const allUsers = await firebaseFetch('users') || {};
    const adminIds = Object.entries(allUsers).filter(([_, u]) => u.role === 'admin').map(([id, _]) => id);
    for (const adminId of adminIds) {
      await sendMessage(adminId, {
        text: `🔔 NEW VIP LEVEL 1 PAYMENT!\n\nUser ID: ${senderId}\nGCash Ref #: ${gcashRef}\n\nAccept below:`,
        quick_replies: [
          { content_type: 'text', title: '✅ Accept VIP 1', payload: `ACCEPT_VIP1_${senderId}_${payKey}` },
          { content_type: 'text', title: '❌ Reject', payload: `REJECT_BUY_${senderId}_${payKey}` }
        ]
      });
    }

    return sendMessage(senderId, {
      text: `⌛ VIP 1 PAYMENT SUBMITTED\n\nReference #: ${gcashRef}\nVerification in progress.`,
      quick_replies: getDynamicQuickReplies('DASHBOARD', userData.role)
    });
  }

  if (currentState?.step === 'WAITING_VIP_LEVEL_2_REF') {
    clearUserState(senderId);
    const gcashRef = input.trim();
    const payRef = 'VIP2-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    const newPayment = { senderId, payRef, gcashRef, vipTier: 2, timestamp: Date.now() };
    const payRes = await firebaseFetch('pending_payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPayment)
    });
    const payKey = payRes?.name || '';

    const allUsers = await firebaseFetch('users') || {};
    const adminIds = Object.entries(allUsers).filter(([_, u]) => u.role === 'admin').map(([id, _]) => id);
    for (const adminId of adminIds) {
      await sendMessage(adminId, {
        text: `🔔 NEW VIP LEVEL 2 PAYMENT!\n\nUser ID: ${senderId}\nGCash Ref #: ${gcashRef}\n\nAccept below:`,
        quick_replies: [
          { content_type: 'text', title: '✅ Accept VIP 2', payload: `ACCEPT_VIP2_${senderId}_${payKey}` },
          { content_type: 'text', title: '❌ Reject', payload: `REJECT_BUY_${senderId}_${payKey}` }
        ]
      });
    }

    return sendMessage(senderId, {
      text: `⌛ VIP 2 PAYMENT SUBMITTED\n\nReference #: ${gcashRef}\nVerification in progress.`,
      quick_replies: getDynamicQuickReplies('DASHBOARD', userData.role)
    });
  }

  if (input.startsWith('ACCEPT_VIP1_')) {
    if (userData.role !== 'admin') return;
    const parts = input.split('_');
    const targetUserId = parts[2];
    const payKey = parts[3];
    if (payKey) await firebaseFetch(`pending_payments/${payKey}`, { method: 'DELETE' });

    const targetUser = await firebaseFetch(`users/${targetUserId}`);
    if (targetUser) {
      await firebaseFetch(`users/${targetUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isVIP: true, vipLevel: 1 })
      });
      await sendMessage(targetUserId, { text: `🎉 UPGRADED TO VIP LEVEL 1!\n\nEnjoy your 100 Points daily check-in rewards.`, quick_replies: getDynamicQuickReplies('DASHBOARD') });
      return sendMessage(senderId, { text: `✅ Approved VIP Level 1 for user ${targetUserId}.`, quick_replies: [{ content_type: 'text', title: '📢 Staff Panel', payload: 'ADMIN_PANEL' }] });
    }
  }

  if (input.startsWith('ACCEPT_VIP2_')) {
    if (userData.role !== 'admin') return;
    const parts = input.split('_');
    const targetUserId = parts[2];
    const payKey = parts[3];
    if (payKey) await firebaseFetch(`pending_payments/${payKey}`, { method: 'DELETE' });

    const targetUser = await firebaseFetch(`users/${targetUserId}`);
    if (targetUser) {
      await firebaseFetch(`users/${targetUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vipLevel: 2 })
      });
      await sendMessage(targetUserId, { text: `🎉 UPGRADED TO VIP LEVEL 2!\n\nAutomatic daily reward claim enabled (200 Points/day)!`, quick_replies: getDynamicQuickReplies('DASHBOARD') });
      return sendMessage(senderId, { text: `✅ Approved VIP Level 2 for user ${targetUserId}.`, quick_replies: [{ content_type: 'text', title: '📢 Staff Panel', payload: 'ADMIN_PANEL' }] });
    }
  }

  if (input.startsWith('ACCEPT_BUY_')) {
    if (userData.role !== 'admin') return;
    const parts = input.split('_');
    const targetUserId = parts[2];
    const coinAmount = parseInt(parts[3], 10);
    const payKey = parts[4];

    if (payKey) await firebaseFetch(`pending_payments/${payKey}`, { method: 'DELETE' });

    const targetUser = await firebaseFetch(`users/${targetUserId}`);
    if (targetUser) {
      const newCoins = (targetUser.rCoins || 0) + coinAmount;
      await firebaseFetch(`users/${targetUserId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rCoins: newCoins, isVIP: true }) });
      await sendMessage(targetUserId, { text: `🎉 PAYMENT VERIFIED & APPROVED!\n\nYour account has been credited with +${coinAmount} Points and upgraded to VIP Status!\nNew Balance: ${newCoins} Points.`, quick_replies: getDynamicQuickReplies('DASHBOARD', targetUser.role) });
      return sendMessage(senderId, { text: `✅ Approved ${coinAmount} Points + VIP for user ${targetUserId}.`, quick_replies: [{ content_type: 'text', title: '📢 Staff Panel', payload: 'ADMIN_PANEL' }] });
    }
  }

  if (input.startsWith('REJECT_BUY_')) {
    if (userData.role !== 'admin') return;
    const parts = input.split('_');
    const targetUserId = parts[2];
    const payKey = parts[3];

    if (payKey) await firebaseFetch(`pending_payments/${payKey}`, { method: 'DELETE' });

    await sendMessage(targetUserId, { text: `❌ PAYMENT UNVERIFIED\n\nYour purchase request could not be verified.`, quick_replies: getDynamicQuickReplies('DASHBOARD') });
    return sendMessage(senderId, { text: `❌ Purchase rejected for user ${targetUserId}.`, quick_replies: [{ content_type: 'text', title: '📢 Staff Panel', payload: 'ADMIN_PANEL' }] });
  }

  if (input.startsWith('APPROVE_SUBANN_')) {
    if (userData.role !== 'admin' && userData.role !== 'moderator') return;
    const subAnnId = input.replace('APPROVE_SUBANN_', '');

    const subAnn = await firebaseFetch(`sub_announcements/${subAnnId}`);
    if (!subAnn) return sendMessage(senderId, { text: '❌ Announcement not found.' });

    await firebaseFetch(`sub_announcements/${subAnnId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'APPROVED' })
    });

    const { active, queued } = await getActiveSubAnnouncements();
    const isQueued = queued.some(q => q.id === subAnnId);

    if (isQueued) {
      const qPos = queued.findIndex(q => q.id === subAnnId) + 1;
      await sendMessage(subAnn.senderId, {
        text: `🎉 SUB-ANNOUNCEMENT APPROVED & QUEUED!\n\nYour announcement was approved and is in queue (Position #${qPos}).`,
        quick_replies: getDynamicQuickReplies('DASHBOARD')
      });
    } else {
      await sendMessage(subAnn.senderId, {
        text: `🎉 SUB-ANNOUNCEMENT IS NOW LIVE!\n\nYour announcement is now live on the Dashboard for ${subAnn.days} Day(s)!`,
        quick_replies: getDynamicQuickReplies('DASHBOARD')
      });
    }

    return sendMessage(senderId, {
      text: `✅ Approved SubAnnouncement ${subAnnId}.`,
      quick_replies: [{ content_type: 'text', title: '📢 Staff Panel', payload: 'ADMIN_PANEL' }]
    });
  }

  if (input.startsWith('REJECT_SUBANN_START_')) {
    if (userData.role !== 'admin' && userData.role !== 'moderator') return;
    const subAnnId = input.replace('REJECT_SUBANN_START_', '');
    setUserState(senderId, { step: 'WAITING_REJECT_REASON', subAnnId });

    return sendMessage(senderId, {
      text: `❌ REJECTING SUB-ANNOUNCEMENT (${subAnnId})\n\nReply below with the reason for rejection:`,
      quick_replies: [{ content_type: 'text', title: '❌ Cancel', payload: 'CANCEL_ACTION' }]
    });
  }

  if (currentState?.step === 'WAITING_REJECT_REASON') {
    const subAnnId = currentState.subAnnId;
    clearUserState(senderId);

    const subAnn = await firebaseFetch(`sub_announcements/${subAnnId}`);
    if (!subAnn) return sendMessage(senderId, { text: '❌ Announcement not found.' });

    await firebaseFetch(`sub_announcements/${subAnnId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'REJECTED', rejectReason: input })
    });

    const targetUser = await firebaseFetch(`users/${subAnn.senderId}`);
    if (targetUser) {
      const refundedCoins = (targetUser.rCoins || 0) + subAnn.points;
      await firebaseFetch(`users/${subAnn.senderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rCoins: refundedCoins })
      });

      await sendMessage(subAnn.senderId, {
        text: `❌ SUB-ANNOUNCEMENT REJECTED & REFUNDED\n\nReason: "${input}"\n\n🎉 Full Refund Credited: +${subAnn.points} Points`,
        quick_replies: getDynamicQuickReplies('DASHBOARD', targetUser.role)
      });
    }

    return sendMessage(senderId, {
      text: `❌ Rejected & refunded SubAnnouncement ${subAnnId}.`,
      quick_replies: [{ content_type: 'text', title: '📢 Staff Panel', payload: 'ADMIN_PANEL' }]
    });
  }

  // --- LEAVE MESSAGE ---
  if (lowerInput.startsWith('/message') || lowerInput === '💬 leave message') {
    if ((userData.messagesToday || 0) >= 2) {
      return sendMessage(senderId, {
        text: `⚠️ DAILY MESSAGE LIMIT REACHED!\n\nYou can only leave up to 2 messages per day.`,
        quick_replies: getDynamicQuickReplies('LEAVE', userData.role)
      });
    }

    const targetName = input.startsWith('/message') ? input.substring(8).trim() : '';
    if (!targetName) {
      setUserState(senderId, { step: 'WAITING_TARGET_NAME' });
      return sendMessage(senderId, {
        text: '✉️ Type the Full Name of the person this message is for:',
        quick_replies: [{ content_type: 'text', title: '❌ Cancel', payload: 'CANCEL_ACTION' }]
      });
    }
    setUserState(senderId, { step: 'WAITING_TITLE', targetName });
    return sendMessage(senderId, {
      text: `Creating a message for "${targetName}".\n\nReply with a Title:`,
      quick_replies: [{ content_type: 'text', title: '❌ Cancel', payload: 'CANCEL_ACTION' }]
    });
  }

  if (currentState?.step === 'WAITING_TARGET_NAME') {
    if (containsBadWords(input)) {
      return sendMessage(senderId, { text: '⚠️ Inappropriate name detected.', quick_replies: [{ content_type: 'text', title: '❌ Cancel', payload: 'CANCEL_ACTION' }] });
    }
    setUserState(senderId, { step: 'WAITING_TITLE', targetName: input });
    return sendMessage(senderId, { text: `Creating a message for "${input}".\n\nReply with a Title:`, quick_replies: [{ content_type: 'text', title: '❌ Cancel', payload: 'CANCEL_ACTION' }] });
  }

  if (currentState?.step === 'WAITING_TITLE') {
    if (containsBadWords(input)) {
      return sendMessage(senderId, { text: '⚠️ Inappropriate title detected.', quick_replies: [{ content_type: 'text', title: '❌ Cancel', payload: 'CANCEL_ACTION' }] });
    }
    setUserState(senderId, { ...currentState, title: input, step: 'WAITING_MOOD' });

    const moodReplies = MOODS.map(m => ({ content_type: 'text', title: m.label, payload: `SET_${m.id}` }));
    moodReplies.push({ content_type: 'text', title: '❌ Cancel', payload: 'CANCEL_ACTION' });

    return sendMessage(senderId, {
      text: 'Title saved! Choose a Mood Category for this confession:',
      quick_replies: moodReplies
    });
  }

  if (currentState?.step === 'WAITING_MOOD' && input.startsWith('SET_MOOD_')) {
    const chosenMood = input.replace('SET_', '');
    setUserState(senderId, { ...currentState, mood: chosenMood, step: 'WAITING_BODY' });
    return sendMessage(senderId, {
      text: 'Mood set! Now type your complete message below:',
      quick_replies: [{ content_type: 'text', title: '❌ Cancel', payload: 'CANCEL_ACTION' }]
    });
  }

  if (currentState?.step === 'WAITING_BODY') {
    if (!currentState.targetName || !currentState.title) {
      clearUserState(senderId);
      return sendMessage(senderId, { text: '⚠️ Session expired.', quick_replies: getDynamicQuickReplies('DASHBOARD', userData.role) });
    }

    if (containsBadWords(input) || isSpamOrGibberish(input)) {
      return sendMessage(senderId, {
        text: '⚠️ Message rejected! Please write a genuine letter (>25 characters):',
        quick_replies: [{ content_type: 'text', title: '❌ Cancel', payload: 'CANCEL_ACTION' }]
      });
    }

    const { targetName, title, mood } = currentState;
    clearUserState(senderId);

    await firebaseFetch('messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetName: targetName.toLowerCase(),
        displayName: targetName,
        title,
        mood: mood || 'MOOD_HEARTBREAK',
        body: input,
        author: 'Anonymous',
        authorCode: userData.userCode,
        ratingSum: 0,
        ratingCount: 0,
        reportCount: 0,
        createdAt: Date.now()
      })
    });

    const newMessagesToday = (userData.messagesToday || 0) + 1;
    const newTotal = (userData.rCoins || 0) + 5;
    await firebaseFetch(`users/${senderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rCoins: newTotal, messagesToday: newMessagesToday })
    });

    return sendMessage(senderId, {
      text: `🕊️ Your unsent letter for "${targetName}" has been safely archived!\n\n🎉 You earned +5 Points for writing!`,
      quick_replies: getDynamicQuickReplies('LEAVE', userData.role)
    });
  }

  // --- RANDOM PAGE ---
  if (lowerInput === '/random' || lowerInput === '📜 random page') {
    clearUserState(senderId);
    const quota = await checkReadingQuota(senderId, userData);
    if (!quota.allowed) {
      return sendMessage(senderId, { text: `🛑 INSUFFICIENT POINTS (Requires 10 Points)!`, quick_replies: getDynamicQuickReplies('RANDOM', userData.role) });
    }

    const allMessages = await firebaseFetch('messages') || {};
    const entries = Object.entries(allMessages);
    if (entries.length === 0) return sendDashboard(senderId, userData);

    const [msgId, randomMsg] = entries[Math.floor(Math.random() * entries.length)];
    return renderFullMessageWithDelay(senderId, msgId, randomMsg, quota, userData.role);
  }

  // --- TRENDING PAGES ---
  if (lowerInput === '/trending' || lowerInput === '🔥 trending pages' || input === 'TRENDING_PAGE_1') {
    clearUserState(senderId);
    return renderTrendingPages(senderId, 0);
  }

  if (input === 'SEARCH_OCCASION_START' || lowerInput === 'search occasion') {
    clearUserState(senderId);
    setUserState(senderId, { step: 'WAITING_OCCASION_DATE' });
    return sendMessage(senderId, {
      text: `📅 SEARCH BY OCCASION (MM/DD)\n\nEnter a date to find birthday, anniversary, or special occasion messages (Example: 08/09):`,
      quick_replies: [{ content_type: 'text', title: '❌ Cancel', payload: 'CANCEL_ACTION' }]
    });
  }

  if (currentState?.step === 'WAITING_OCCASION_DATE') {
    clearUserState(senderId);
    const dateQuery = input.trim();
    const allMessages = await firebaseFetch('messages') || {};

    const matches = Object.entries(allMessages)
      .map(([id, val]) => ({ id, ...val }))
      .filter(m => m.title && m.title.includes(dateQuery) || (m.body && m.body.includes(dateQuery)));

    if (matches.length === 0) {
      return sendMessage(senderId, {
        text: `ℹ️ No occasion messages found matching date "${dateQuery}".`,
        quick_replies: getDynamicQuickReplies('DASHBOARD', userData.role)
      });
    }

    return renderSearchResults(senderId, matches, 0, `📅 OCCASION (${dateQuery})`);
  }

  if (lowerInput.startsWith('/search') || lowerInput === '🔍 search name') {
    const targetName = input.startsWith('/search') ? input.substring(7).trim().toLowerCase() : '';
    if (!targetName) {
      setUserState(senderId, { step: 'WAITING_SEARCH_NAME' });
      return sendMessage(senderId, { text: '🔍 Type the Full Name or part of the name of the recipient you wish to search for:', quick_replies: [{ content_type: 'text', title: '❌ Cancel', payload: 'CANCEL_ACTION' }] });
    }
    clearUserState(senderId);
    return executeSearch(senderId, targetName);
  }

  if (currentState?.step === 'WAITING_SEARCH_NAME') {
    clearUserState(senderId);
    return executeSearch(senderId, lowerInput);
  }

  if (currentState?.step === 'VIEWING_SEARCH_RESULTS') {
    if (input === 'NEXT_PAGE') {
      const nextIdx = currentState.pageIndex + 5;
      return renderSearchResults(senderId, currentState.allMatches, nextIdx, currentState.searchTitle);
    }
    if (input === 'PREV_PAGE') {
      const prevIdx = Math.max(0, currentState.pageIndex - 5);
      return renderSearchResults(senderId, currentState.allMatches, prevIdx, currentState.searchTitle);
    }

    let selectedIndex = -1;
    const emojiMatchIndex = EMOJI_NUMBERS.indexOf(input);
    if (emojiMatchIndex !== -1) selectedIndex = emojiMatchIndex;
    else if (/^[1-5]$/.test(input)) selectedIndex = parseInt(input, 10) - 1;

    if (selectedIndex !== -1 && currentState.searchResults?.[selectedIndex]) {
      const msg = currentState.searchResults[selectedIndex];
      clearUserState(senderId);

      const quota = await checkReadingQuota(senderId, userData);
      if (!quota.allowed) {
        return sendMessage(senderId, { text: `🛑 INSUFFICIENT POINTS!`, quick_replies: getDynamicQuickReplies('SEARCH', userData.role) });
      }
      return renderFullMessageWithDelay(senderId, msg.id, msg, quota, userData.role);
    }
  }

  if (input.startsWith('READ_')) {
    clearUserState(senderId);
    const quota = await checkReadingQuota(senderId, userData);
    if (!quota.allowed) {
      return sendMessage(senderId, { text: `🛑 INSUFFICIENT POINTS (Requires 10 Points)!`, quick_replies: getDynamicQuickReplies('DASHBOARD', userData.role) });
    }

    const msgId = input.replace('READ_', '');
    const data = await firebaseFetch(`messages/${msgId}`);
    if (!data) return sendDashboard(senderId, userData);

    return renderFullMessageWithDelay(senderId, msgId, data, quota, userData.role);
  }

  if (input.startsWith('RATE_')) {
    const parts = input.split('_');
    const msgId = parts[1];
    const score = parseInt(parts[2], 10);

    const ratedMap = userData.ratedMsgs || {};
    if (ratedMap[msgId]) {
      return sendMessage(senderId, {
        text: `⚠️ You have already rated this message once!`,
        quick_replies: getDynamicQuickReplies('DASHBOARD', userData.role)
      });
    }

    ratedMap[msgId] = score;
    const msg = await firebaseFetch(`messages/${msgId}`) || {};
    await firebaseFetch(`messages/${msgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ratingSum: (msg.ratingSum || 0) + score,
        ratingCount: (msg.ratingCount || 0) + 1
      })
    });

    const newCoins = (userData.rCoins || 0) + 5;
    await firebaseFetch(`users/${senderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rCoins: newCoins, ratedMsgs: ratedMap })
    });

    return sendMessage(senderId, {
      text: `⭐ Thank you! You rated this message ${score}/5.\n\n🎉 +5 Points refunded!`,
      quick_replies: getDynamicQuickReplies('DASHBOARD', userData.role)
    });
  }

  if (input.startsWith('REPORT_START_')) {
    const msgId = input.replace('REPORT_START_', '');
    const reasonReplies = REPORT_REASONS.map(r => ({
      content_type: 'text',
      title: r,
      payload: `SUBMIT_REPORT_${msgId}_${r}`
    }));
    return sendMessage(senderId, {
      text: `🛡️ SELECT REPORT REASON:`,
      quick_replies: reasonReplies
    });
  }

  if (input.startsWith('SUBMIT_REPORT_')) {
    const parts = input.split('_');
    const msgId = parts[2];
    const reason = parts[3];

    const msg = await firebaseFetch(`messages/${msgId}`) || {};
    const newReportCount = (msg.reportCount || 0) + 1;
    let reporters = msg.reporters || [];
    if (!reporters.includes(senderId)) reporters.push(senderId);

    await firebaseFetch(`messages/${msgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportCount: newReportCount, reportReason: reason, reporters })
    });

    return sendMessage(senderId, {
      text: `🛡️ Report submitted (${reason}). If approved, you will be rewarded +1 Point!`,
      quick_replies: getDynamicQuickReplies('DASHBOARD', userData.role)
    });
  }

  if (input === 'BROWSE_MOODS' || lowerInput === '🎭 browse moods') {
    clearUserState(senderId);
    const quickReplies = MOODS.map(m => ({ content_type: 'text', title: m.label, payload: `SELECT_${m.id}` }));
    quickReplies.push({ content_type: 'text', title: '📊 My Dashboard', payload: 'USER_DASHBOARD' });

    return sendMessage(senderId, {
      text: `🎭 BROWSE BY MOOD\n\nSelect a mood category:`,
      quick_replies: quickReplies
    });
  }

  if (input.startsWith('SELECT_MOOD_') || input.startsWith('SELECT_MOOD_')) {
    clearUserState(senderId);
    const selectedMood = input.replace('SELECT_', '');
    const allMessages = await firebaseFetch('messages') || {};

    const matches = Object.entries(allMessages)
      .map(([id, val]) => ({ id, ...val }))
      .filter(m => m.mood === selectedMood);

    if (matches.length === 0) {
      return sendMessage(senderId, {
        text: `ℹ️ No confessions found for this mood category yet.`,
        quick_replies: [
          { content_type: 'text', title: '🎭 Browse Moods', payload: 'BROWSE_MOODS' },
          { content_type: 'text', title: '📊 My Dashboard', payload: 'USER_DASHBOARD' }
        ]
      });
    }

    return renderSearchResults(senderId, matches, 0, `🎭 MOOD (${selectedMood})`);
  }

  if (lowerInput === '/checkin' || lowerInput === '📅 daily check-in') {
    clearUserState(senderId);
    const todayStr = new Date().toISOString().split('T')[0];

    if (userData.lastCheckinDate === todayStr) {
      const badge = getStreakBadge(userData.streak || 0);
      return sendMessage(senderId, {
        text: `📅 DAILY CHECK-IN\n\nStreak: ${userData.streak || 0} Day(s) (${badge})\nYou have already claimed your daily reward today!`,
        quick_replies: getDynamicQuickReplies('CHECKIN', userData.role)
      });
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak = (userData.lastCheckinDate === yesterdayStr) ? (userData.streak || 0) + 1 : 1;
    const baseReward = userData.isVIP ? 100 : 50;
    const streakBonus = Math.floor(newStreak / 5) * 10;
    const totalReward = baseReward + streakBonus;

    const newCoins = (userData.rCoins || 0) + totalReward;
    const badge = getStreakBadge(newStreak);

    await firebaseFetch(`users/${senderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rCoins: newCoins, streak: newStreak, lastCheckinDate: todayStr })
    });

    return sendMessage(senderId, {
      text: `📅 CHECK-IN SUCCESSFUL!\n\n🔥 Current Streak: ${newStreak} Day(s)\n🏅 Badge: ${badge}\n🪙 Earned: +${totalReward} Points\n💰 Total Balance: ${newCoins} Points`,
      quick_replies: getDynamicQuickReplies('CHECKIN', userData.role)
    });
  }

  clearUserState(senderId);
  return sendDashboard(senderId, userData);
}

async function renderSearchResults(senderId, allMatches, pageIndex, searchTitle) {
  const pageSize = 5;
  const sliceMatches = allMatches.slice(pageIndex, pageIndex + pageSize);

  let text = `${searchTitle} (Showing ${pageIndex + 1}-${Math.min(pageIndex + pageSize, allMatches.length)} of ${allMatches.length}):\n\n`;
  const quickReplies = [];

  sliceMatches.forEach((m, idx) => {
    const emoji = EMOJI_NUMBERS[idx] || `${idx + 1}`;
    const ratingDisp = formatRatingDisplay(m.ratingSum, m.ratingCount);
    text += `${emoji} ${ratingDisp} | ${m.displayName} - ${m.title}\n`;
    quickReplies.push({ content_type: 'text', title: emoji, payload: `READ_${m.id}` });
  });

  if (pageIndex > 0) {
    quickReplies.push({ content_type: 'text', title: '⬅️ Previous', payload: 'PREV_PAGE' });
  }
  if (pageIndex + pageSize < allMatches.length) {
    quickReplies.push({ content_type: 'text', title: '➡️ Next', payload: 'NEXT_PAGE' });
  }

  quickReplies.push({ content_type: 'text', title: '❌ Cancel', payload: 'CANCEL_ACTION' });

  setUserState(senderId, { step: 'VIEWING_SEARCH_RESULTS', searchResults: sliceMatches, allMatches, pageIndex, searchTitle });
  return sendMessage(senderId, { text, quick_replies: quickReplies });
}

async function renderTrendingPages(senderId, pageIndex) {
  const allMessages = await firebaseFetch('messages') || {};
  const sorted = Object.entries(allMessages)
    .map(([id, val]) => ({ id, ...val }))
    .filter(m => m.ratingCount && m.ratingCount > 0)
    .sort((a, b) => (b.ratingSum / b.ratingCount) - (a.ratingSum / a.ratingCount));

  if (sorted.length === 0) {
    return sendMessage(senderId, { text: 'ℹ️ No rated messages yet.', quick_replies: getDynamicQuickReplies('DASHBOARD') });
  }

  return renderSearchResults(senderId, sorted, pageIndex, '🔥 TRENDING PAGES');
}

async function executeSearch(senderId, searchKeyword) {
  const allMessages = await firebaseFetch('messages') || {};
  const query = searchKeyword.toLowerCase().trim();

  const matches = Object.entries(allMessages)
    .map(([id, val]) => ({ id, ...val }))
    .filter(m => (m.targetName && m.targetName.includes(query)) || (m.displayName && m.displayName.toLowerCase().includes(query)) || (m.title && m.title.toLowerCase().includes(query)));

  if (matches.length === 0) {
    await sendMessage(senderId, { text: `ℹ️ No entries found matching "${searchKeyword}".` });
    return sendDashboard(senderId, await ensureUser(senderId));
  }

  return renderSearchResults(senderId, matches, 0, `🔍 SEARCH (${searchKeyword})`);
}

async function renderAdminPanel(senderId, userData) {
  const usersObj = await firebaseFetch('users') || {};
  const msgsObj = await firebaseFetch('messages') || {};
  const paymentsObj = await firebaseFetch('pending_payments') || {};
  const subAnnObj = await firebaseFetch('sub_announcements') || {};

  const totalUsers = Object.keys(usersObj).length;
  const totalVIPs = Object.values(usersObj).filter(u => u.isVIP).length;
  const totalMsgs = Object.keys(msgsObj).length;
  const pendingReports = Object.values(msgsObj).filter(m => m.reportCount && m.reportCount > 0).length;
  const pendingPaymentsCount = Object.keys(paymentsObj).length;
  const pendingSubAnnCount = Object.values(subAnnObj).filter(a => a.status === 'PENDING_APPROVAL').length;

  return sendMessage(senderId, {
    text: `📢 STAFF ADMIN PANEL\n\nRole: ${userData.role.toUpperCase()}\n------\n📈 SYSTEM STATISTICS\n\n👥 Total Registered Users: ${totalUsers}\n🌟 Active VIP Members: ${totalVIPs}\n📖 Total Messages Archived: ${totalMsgs}\n💳 Pending GCash Payments: ${pendingPaymentsCount}\n📣 Pending SubAnnouncements: ${pendingSubAnnCount}\n🚩 Pending Message Reports: ${pendingReports}\n\nSelect a staff tool below:`,
    quick_replies: [
      { content_type: 'text', title: '📣 Review SubAnnounce', payload: 'REVIEW_SUB_ANNOUNCEMENTS' },
      { content_type: 'text', title: '💳 Pending Payments', payload: 'VIEW_PENDING_PAYMENTS' },
      { content_type: 'text', title: '📢 Broadcast Msg', payload: 'ADMIN_BROADCAST_START' },
      { content_type: 'text', title: '🛡️ Review Reports', payload: 'STAFF_REPORTS' },
      { content_type: 'text', title: '📊 My Dashboard', payload: 'USER_DASHBOARD' }
    ]
  });
}

async function renderFullMessageWithDelay(senderId, msgId, data, quotaInfo, role) {
  const userData = await ensureUser(senderId);
  const ratingDisp = formatRatingDisplay(data.ratingSum, data.ratingCount);
  const quotaNote = `\n\n🪙 (10 Points deducted for reading)`;
  const text = `📖 TO: ${data.displayName}\n🏷️ TITLE: ${data.title}\n👤 USER: ${data.authorCode || '#SYS999'}\n⭐ RATING: ${ratingDisp}\n\n"${data.body}"${quotaNote}`;

  const payload = {
    text,
    quick_replies: [
      { content_type: 'text', title: '⭐ 1', payload: `RATE_${msgId}_1` },
      { content_type: 'text', title: '⭐ 2', payload: `RATE_${msgId}_2` },
      { content_type: 'text', title: '⭐ 3', payload: `RATE_${msgId}_3` },
      { content_type: 'text', title: '⭐ 4', payload: `RATE_${msgId}_4` },
      { content_type: 'text', title: '⭐ 5', payload: `RATE_${msgId}_5` },
      { content_type: 'text', title: '🚩 Report', payload: `REPORT_START_${msgId}` },
      { content_type: 'text', title: '📜 Read Another', payload: '/random' },
      { content_type: 'text', title: '📊 Dashboard', payload: 'USER_DASHBOARD' }
    ]
  };

  if (userData.vipLevel === 2) {
    return sendMessage(senderId, payload);
  } else {
    await sendSenderAction(senderId, 'typing_on');
    await new Promise(resolve => setTimeout(resolve, 5000));
    return sendMessage(senderId, payload);
  }
}

async function sendDashboard(senderId, userData) {
  const announcements = await firebaseFetch('announcements') || {};
  const annList = Object.values(announcements);
  const latestAnn = annList.length > 0 ? annList[annList.length - 1].content : 'Welcome to Pages He Never Sent!';

  const { active, queued } = await getActiveSubAnnouncements();
  const vipBadge = userData.isVIP ? ' 🌟 (VIP)' : '';
  const streakBadge = getStreakBadge(userData.streak || 0);

  const balanceLine = `${userData.rCoins || 0} RCoins${vipBadge}`;
  const streakLine = `${userData.streak || 0} Days  | ${streakBadge} |`;
  const systemAnnLine = `"${latestAnn}"`;

  let text = `Personal Dashboard 📊\n\n`;
  text += `${toBoldUnicode('🪙 Points Balance:')}\n • ${toBoldUnicode(balanceLine)}\n\n`;
  text += `${toBoldUnicode('🔥 Check-in Streak:')}\n• ${toBoldUnicode(streakLine)}\n\n`;
  text += `--------------------\n`;
  text += `${toBoldUnicode('📢 System Announcement:')}\n\n`;
  text += `• ${toItalicUnicode(systemAnnLine)}\n\n`;
  text += `--------------------\n`;
  text += `${toBoldUnicode('📢 Sub Announcement')}\n\n`;

  if (active.length > 0) {
    active.forEach(a => {
      text += `• ${toItalicUnicode(a.text)}\n\n`;
    });
  } else {
    text += `• ${toItalicUnicode('No active sub-announcements right now.')}\n\n`;
  }

  text += `--------------------`;

  const quickReplies = getDynamicQuickReplies('DASHBOARD', userData.role);
  return sendMessage(senderId, { text, quick_replies: quickReplies });
}

async function sendNextReport(senderId, userData) {
  const allMessages = await firebaseFetch('messages') || {};
  const reportedMsgs = Object.entries(allMessages)
    .map(([id, val]) => ({ id, ...val }))
    .filter(m => m.reportCount && m.reportCount > 0);

  if (reportedMsgs.length === 0) {
    await sendMessage(senderId, { text: '🛡️ No pending reported messages to review.' });
    return renderAdminPanel(senderId, userData);
  }

  const current = reportedMsgs[0];
  const text = `[STAFF PANEL]\n🚩 Pending Report (1 of ${reportedMsgs.length})\n\nMessage ID: ${current.id}\nTarget: ${current.displayName}\nTitle: ${current.title}\nBody: "${current.body}"\nReason: ${current.reportReason || 'Inappropriate'}\nReport Count: ${current.reportCount}\n\nSelect an action:`;

  return sendMessage(senderId, {
    text,
    quick_replies: [
      { content_type: 'text', title: '🗑️ Delete Message', payload: `DEL_MSG_${current.id}` },
      { content_type: 'text', title: '✅ Keep Message', payload: `KEEP_MSG_${current.id}` },
      { content_type: 'text', title: '📢 Staff Panel', payload: 'ADMIN_PANEL' }
    ]
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await autoSeedDataOnStartup();
  await registerPersistentMenu();
});
