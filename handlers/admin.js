export async function handleAdminCommands(senderId, input, userData, firebaseFetch, sendMessage, sendDashboard) {
  if (input === 'ADMIN_PANEL' || input === '📢 staff panel' || input === 'VIEW_STATS') {
    if (userData.role !== 'admin' && userData.role !== 'moderator') return sendDashboard(senderId, userData);

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

    await sendMessage(senderId, {
      text: `📢 STAFF ADMIN PANEL\n\nRole: ${userData.role.toUpperCase()}\n------\n📈 SYSTEM STATISTICS\n\n👥 Total Registered Users: ${totalUsers}\n🌟 Active VIP Members: ${totalVIPs}\n📖 Total Messages Archived: ${totalMsgs}\n💳 Pending GCash Payments: ${pendingPaymentsCount}\n📣 Pending SubAnnouncements: ${pendingSubAnnCount}\n🚩 Pending Message Reports: ${pendingReports}\n\nSelect a staff tool below:`,
      quick_replies: [
        { content_type: 'text', title: '📣 Review SubAnnounce', payload: 'REVIEW_SUB_ANNOUNCEMENTS' },
        { content_type: 'text', title: '💳 Pending Payments', payload: 'VIEW_PENDING_PAYMENTS' },
        { content_type: 'text', title: '📢 Broadcast Msg', payload: 'ADMIN_BROADCAST_START' },
        { content_type: 'text', title: '🛡️ Review Reports', payload: 'STAFF_REPORTS' },
        { content_type: 'text', title: '📊 My Dashboard', payload: 'USER_DASHBOARD' }
      ]
    });
    return true;
  }
  return false;
}
