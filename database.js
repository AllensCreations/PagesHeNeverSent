import fs from 'fs';
import crypto from 'crypto';
if (fs.existsSync('.env')) { process.loadEnvFile('.env'); }

export const FIREBASE_URL = process.env.FIREBASE_URL ? process.env.FIREBASE_URL.replace(/\/$/, '') : '';
export const FIREBASE_SECRET = process.env.FIREBASE_SECRET || '';
export const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || '';
export const VERIFY_TOKEN = process.env.VERIFY_TOKEN || '';
export const APP_SECRET = process.env.APP_SECRET || '';

export const EMOJI_NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
export const STATE_TIMEOUT_MS = 15 * 60 * 1000;

export async function firebaseFetch(path, options = {}) {
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

export async function getUserState(senderId) {
  const state = await firebaseFetch(`users/${senderId}/state`);
  if (state && state.expiresAt && state.expiresAt < Date.now()) return null;
  return state;
}

export async function setUserState(senderId, state) {
  return firebaseFetch(`users/${senderId}/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...state, expiresAt: Date.now() + STATE_TIMEOUT_MS })
  });
}

export async function clearUserState(senderId) {
  return firebaseFetch(`users/${senderId}/state`, { method: 'DELETE' });
}

export async function sendMessage(recipientId, payload) {
  if (!PAGE_ACCESS_TOKEN) return;
  try {
    await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: recipientId }, message: payload })
    });
  } catch (err) {
    console.error('Outbound Delivery Error:', err);
  }
}

export function verifySignature(rawBody, signatureHeader) {
  if (!APP_SECRET || !signatureHeader) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

export function getDynamicQuickReplies(activeContext, role = 'user') {
  return [
    { content_type: 'text', title: '📜 Random Item', payload: '/random' },
    { content_type: 'text', title: '🔍 Search', payload: '/search' },
    { content_type: 'text', title: '📊 Dashboard', payload: 'USER_DASHBOARD' }
  ];
}
