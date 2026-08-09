import { firebaseFetch, sendMessage } from '../database.js';

export async function renderAdminPanel(senderId) {
  const usersObj = await firebaseFetch('users') || {};
  const totalUsers = Object.keys(usersObj).length;

  return sendMessage(senderId, {
    text: `📢 STAFF ADMIN PANEL\n\n👥 Total Users: ${totalUsers}\n\nSelect a tool:`,
    quick_replies: [
      { content_type: 'text', title: '📊 Dashboard', payload: 'USER_DASHBOARD' }
    ]
  });
}
