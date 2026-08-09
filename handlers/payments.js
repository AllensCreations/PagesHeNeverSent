import { sendMessage, getDynamicQuickReplies, clearUserState } from '../database.js';

export async function handlePaymentCommands(senderId, input, lowerInput, userData) {
  if (input === 'BUY_ITEMS' || lowerInput === 'buy') {
    await clearUserState(senderId);
    return sendMessage(senderId, {
      text: `🪙 UPGRADE SYSTEM\n\nContact admin to process upgrade.`,
      quick_replies: getDynamicQuickReplies('BUY', userData.role)
    }), true;
  }
  return false;
}
