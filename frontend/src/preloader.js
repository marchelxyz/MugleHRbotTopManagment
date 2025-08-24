// frontend/src/preloader.js
import { getMarketItems, getLastMonthLeaderboard, getUserTransactions, getFeed } from './api';

const preloadedData = {
  market: null,
  leaderboard: null,
  history: null,
  feed: null,
};

export const preloadInitialData = () => {
  console.log('Starting initial data preloading...');
  
  getMarketItems()
    .then(response => {
      preloadedData.market = response.data;
      console.log('Market data preloaded.');
    })
    .catch(err => console.error('Failed to preload market data:', err));

  getLastMonthLeaderboard()
    .then(response => {
      preloadedData.leaderboard = response.data;
      console.log('Leaderboard data preloaded.');
    })
    .catch(err => console.error('Failed to preload leaderboard data:', err));

  getFeed()
    .then(response => { preloadedData.feed = response.data; console.log('Feed data preloaded.'); })
    .catch(err => console.error('Failed to preload feed data:', err)); // --- ИСПРАВЛЕНИЕ: Добавлена ; ---
};

export const preloadHistoryData = (userId) => {
    if (preloadedData.history || !userId) return;

    console.log(`Preloading transaction history for user ${userId}...`);
    getUserTransactions(userId)
        .then(response => {
            preloadedData.history = response.data;
            console.log('History data preloaded.');
        })
        .catch(err => console.error('Failed to preload history data:', err));
};

export const getPreloadedData = (key) => {
  return preloadedData[key];
};

export const clearCache = (key) => {
    if (preloadedData[key]) {
        preloadedData[key] = null;
        console.log(`Cache for "${key}" cleared.`);
    }
}
