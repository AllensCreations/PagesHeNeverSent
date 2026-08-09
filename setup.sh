#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

echo "==================================================--"
echo "🚀 MESSENGER BOT MODULAR PROJECT GENERATOR & SETUP"
echo "==================================================--"

# ----------------------------------------------------
# 2. GitHub Auth & Repository Selection
# ----------------------------------------------------
echo "----------------------------------------------------"
echo "🔐 GITHUB AUTHENTICATION & REPOSITORY SETUP"
echo "----------------------------------------------------"

if ! gh auth status -h github.com > /dev/null 2>&1; then
    echo "🔑 Please authenticate with your GitHub account:"
    gh auth login --web -h github.com
else
    echo "✅ Already authenticated as $(gh api user --jq .login 2>/dev/null || echo 'unknown user')."
    read -rp "Use this account? (y/n): " KEEP_AUTH
    if [[ "$KEEP_AUTH" != "y" && "$KEEP_AUTH" != "Y" ]]; then
        gh auth logout --hostname github.com || true
        gh auth login --web -h github.com
    fi
fi

echo "🔍 Fetching your GitHub repositories..."
mapfile -t REPO_ARRAY < <(gh repo list --limit 30 --json name,owner,visibility --jq '.[] | "\(.owner.login)/\(.name) (\(.visibility))"' 2>/dev/null || true)

if [ "${#REPO_ARRAY[@]}" -eq 0 ]; then
    echo "⚠️ No repositories found. You'll need to create one."
    REPO_ARRAY=("✨ Create a New Repository")
else
    REPO_ARRAY+=("✨ Create a New Repository")
fi

echo "📋 Select a repository to link this project to:"
select REPO_CHOICE in "${REPO_ARRAY[@]}"; do
    if [ "$REPO_CHOICE" = "✨ Create a New Repository" ] || [ -z "$REPO_CHOICE" ]; then
        read -rp "Enter new repository name (letters, numbers, - and _ only): " NEW_REPO_NAME
        if [[ ! "$NEW_REPO_NAME" =~ ^[A-Za-z0-9_-]+$ ]]; then
            echo "❌ Invalid repository name."
            exit 1
        fi
        read -rp "Make repository private? (y/n): " IS_PRIVATE
        PRIV_FLAG="--public"
        [[ "$IS_PRIVATE" =~ ^[Yy]$ ]] && PRIV_FLAG="--private"
        gh repo create "$NEW_REPO_NAME" $PRIV_FLAG --confirm
        TARGET_REPO=$(gh repo view "$NEW_REPO_NAME" --json nameWithOwner --jq '.nameWithOwner')
        break
    elif [ -n "$REPO_CHOICE" ]; then
        TARGET_REPO=$(echo "$REPO_CHOICE" | awk '{print $1}')
        break
    else
        echo "❌ Invalid selection. Try again."
    fi
done

echo "🔗 Linked Repository: $TARGET_REPO"

# ----------------------------------------------------
# 3. Credentials
# ----------------------------------------------------
echo "----------------------------------------------------"
echo "🔑 FACEBOOK & FIREBASE CREDENTIALS COLLECTION"
echo "----------------------------------------------------"
read -rp "Enter App ID: " APP_ID
read -rsp "Enter App Secret: " APP_SECRET; echo ""
read -rsp "Enter Short-Lived Access Token (User or Page Token): " SHORT_TOKEN; echo ""

echo "🔄 Attempting to resolve a long-lived Page Access Token..."

DEBUG_RESPONSE=$(curl -s "https://graph.facebook.com/debug_token?input_token=$SHORT_TOKEN&access_token=${APP_ID}|${APP_SECRET}")
TOKEN_TYPE=$(echo "$DEBUG_RESPONSE" | jq -r '.data.type // empty')

if [ "$TOKEN_TYPE" = "PAGE" ]; then
    echo "ℹ️ Detected a Page token already. Using it directly."
    ACTIVE_TOKEN="$SHORT_TOKEN"
else
    LONG_USER_RESPONSE=$(curl -s "https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=$APP_ID&client_secret=$APP_SECRET&fb_exchange_token=$SHORT_TOKEN")
    LONG_USER_TOKEN=$(echo "$LONG_USER_RESPONSE" | jq -r '.access_token // empty')

    if [ -z "$LONG_USER_TOKEN" ]; then
        echo "⚠️ Token exchange failed: $(echo "$LONG_USER_RESPONSE" | jq -r '.error.message // "unknown error"')"
        echo "   Falling back to using the token you provided as-is."
        ACTIVE_TOKEN="$SHORT_TOKEN"
    else
        PAGES_RESPONSE=$(curl -s "https://graph.facebook.com/v19.0/me/accounts?access_token=$LONG_USER_TOKEN")
        PAGE_TOKEN=$(echo "$PAGES_RESPONSE" | jq -r '.data[0].access_token // empty')
        if [ -n "$PAGE_TOKEN" ]; then
            echo "✅ Acquired a long-lived Page Access Token."
            ACTIVE_TOKEN="$PAGE_TOKEN"
        else
            echo "⚠️ No Pages found under this account. Using the long-lived user token."
            ACTIVE_TOKEN="$LONG_USER_TOKEN"
        fi
    fi
fi

read -rp "Enter Firebase Realtime Database URL (e.g., https://xxx.firebaseio.com): " FIREBASE_URL
if [[ ! "$FIREBASE_URL" =~ ^https://.+\.firebaseio\.com/?$ ]]; then
    echo "⚠️ That doesn't look like a standard Firebase RTDB URL — continuing anyway, but double-check it."
fi
read -rsp "Enter Firebase Database Secret/Auth Token: " FIREBASE_SECRET; echo ""

VERIFY_TOKEN=$(head -c 24 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 24)

# ----------------------------------------------------
# 4. Project Scaffolding
# ----------------------------------------------------
echo "----------------------------------------------------"
echo "🏗️ BUILDING MODULAR PROJECT STRUCTURE"
echo "----------------------------------------------------"

PROJECT_DIR="messenger-bot-modular"
mkdir -p "$PROJECT_DIR/handlers"
cd "$PROJECT_DIR"

npm init -y > /dev/null 2>&1

NODE_DEPENDENCIES=()

jq '. + {type: "module", main: "server.js", scripts: {start: "node server.js"}}' package.json > package.json.tmp && mv package.json.tmp package.json

cat << ENV > .env
PORT=3000
PAGE_ACCESS_TOKEN=$ACTIVE_TOKEN
VERIFY_TOKEN=$VERIFY_TOKEN
APP_SECRET=$APP_SECRET
FIREBASE_URL=$FIREBASE_URL
FIREBASE_SECRET=$FIREBASE_SECRET
ENV

cat << 'ENVEX' > .env.example
PORT=3000
PAGE_ACCESS_TOKEN=
VERIFY_TOKEN=
APP_SECRET=
FIREBASE_URL=
FIREBASE_SECRET=
ENVEX

cat << 'GI' > .gitignore
node_modules/
.env
.DS_Store
GI

cat << 'EOF' > database.js
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
