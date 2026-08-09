import { sendMessage, getDynamicQuickReplies, clearUserState } from '../database.js';

export async function handleReaderCommands(senderId, input, lowerInput, userData) {
  if (lowerInput === '/random' || lowerInput === '📜 random item') {
    await clearUserState(senderId);
    await sendMessage(senderId, {
      text: `📜 Random feature executed successfully!`,
      quick_replies: getDynamicQuickReplies('RANDOM', userData.role)
    });
    return true;
  }
  return false;
}
