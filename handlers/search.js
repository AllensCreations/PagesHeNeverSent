export async function handleSearchCommands(senderId, input, currentState, firebaseFetch, sendMessage, sendDashboard, renderSearchResults, EMOJI_NUMBERS, formatRatingDisplay) {
  const lowerInput = input.toLowerCase();

  if (lowerInput === '/trending' || lowerInput === '🔥 trending pages' || input === 'TRENDING_PAGE_1') {
    const allMessages = await firebaseFetch('messages') || {};
    const allEntries = Object.entries(allMessages).map(([id, val]) => ({ id, ...val }));
    let trendingFiltered = allEntries.filter(m => m.ratingCount && m.ratingCount >= 100);

    if (trendingFiltered.length === 0) {
      trendingFiltered = allEntries
        .filter(m => m.ratingCount && m.ratingCount > 0)
        .sort((a, b) => (b.ratingSum / b.ratingCount) - (a.ratingSum / a.ratingCount))
        .slice(0, 5);
    } else {
      trendingFiltered.sort((a, b) => (b.ratingSum / b.ratingCount) - (a.ratingSum / a.ratingCount));
    }

    if (trendingFiltered.length === 0) {
      await sendMessage(senderId, { text: 'ℹ️ No rated messages yet.' });
      return true;
    }

    await renderSearchResults(senderId, trendingFiltered, 0, '🔥 TRENDING PAGES (TOP 5)');
    return true;
  }

  return false;
}
