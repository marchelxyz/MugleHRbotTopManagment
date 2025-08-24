// frontend/src/preloader.js
import { getMarketItems, getLastMonthLeaderboard, getUserTransactions } from './api';

// Создаем простой объект для хранения кэшированных данных
const preloadedData = {
  market: null,
  leaderboard: null,
  history: null,
  feed: null,
};

// Функция для предзагрузки данных Магазина и Рейтинга
export const preloadInitialData = () => {
  console.log('Starting initial data preloading...');
  
  // Загружаем данные магазина
  getMarketItems()
    .then(response => {
      preloadedData.market = response.data;
      console.log('Market data preloaded.');
    })
    .catch(err => console.error('Failed to preload market data:', err));

  // Загружаем данные рейтинга
  getLastMonthLeaderboard()
    .then(response => {
      preloadedData.leaderboard = response.data;
      console.log('Leaderboard data preloaded.');
    })
    .catch(err => console.error('Failed to preload leaderboard data:', err));
};

 getFeed()
    .then(response => { preloadedData.feed = response.data; console.log('Feed data preloaded.'); })
    .catch(err => console.error('Failed to preload feed data:', err));
};

// Функция для предзагрузки истории транзакций пользователя
export const preloadHistoryData = (userId) => {
    // Не загружаем повторно, если данные уже есть
    if (preloadedData.history || !userId) return;

    console.log(`Preloading transaction history for user ${userId}...`);
    getUserTransactions(userId)
        .then(response => {
            preloadedData.history = response.data;
            console.log('History data preloaded.');
        })
        .catch(err => console.error('Failed to preload history data:', err));
};


// Функция для получения данных из кэша
export const getPreloadedData = (key) => {
  return preloadedData[key];
};

// Функция для очистки кэша (например, после покупки)
export const clearCache = (key) => {
    if (preloadedData[key]) {
        preloadedData[key] = null;
        console.log(`Cache for "${key}" cleared.`);
    }
}
