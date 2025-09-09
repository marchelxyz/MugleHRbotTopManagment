// frontend/src/storage.js (НОВЫЙ ФАЙЛ)

import { getFeed, getMarketItems, getLastMonthLeaderboard, getUserTransactions } from './api';

// Получаем доступ к API хранилища
const storage = window.Telegram.WebApp.CloudStorage;

// Локальная переменная для мгновенного доступа после первой загрузки
const memoryCache = {
  feed: null,
  market: null,
  leaderboard: null,
  history: null,
};

/**
 * Асинхронно получает значение из локального хранилища TWA.
 * @param {string} key Ключ, по которому нужно найти данные.
 * @returns {Promise<any|null>} Распарсенный JSON-объект или null.
 */
const getStoredValue = (key) => {
  return new Promise((resolve) => {
    storage.getItem(key, (error, value) => {
      if (error || !value) {
        resolve(null);
      } else {
        try {
          resolve(JSON.parse(value));
        } catch (e) {
          resolve(null);
        }
      }
    });
  });
};

/**
 * Инициализирует кэш при запуске приложения.
 * Загружает данные из локального хранилища в память для быстрого доступа.
 */
export const initializeCache = async () => {
  console.log('Initializing local storage cache...');
  
  const [feed, market, leaderboard] = await Promise.all([
    getStoredValue('feed'),
    getStoredValue('market'),
    getStoredValue('leaderboard')
  ]);
  
  memoryCache.feed = feed;
  memoryCache.market = market;
  memoryCache.leaderboard = leaderboard;

  console.log('Cache initialized from local storage:', memoryCache);
  
  // После инициализации, асинхронно обновляем данные с сервера
  refreshAllData();
};

/**
 * Получает данные из кэша в памяти (синхронно).
 * @param {'feed' | 'market' | 'leaderboard' | 'history'} key Ключ данных.
 */
export const getCachedData = (key) => {
  return memoryCache[key];
};

/**
 * Полностью обновляет все кэшируемые данные, запрашивая их с сервера
 * и сохраняя как в локальное хранилище, так и в память.
 */
export const refreshAllData = async () => {
  console.log('Refreshing all data from API...');
  try {
    const [feedRes, marketRes, leaderboardRes] = await Promise.all([
      getFeed(),
      getMarketItems(),
      getLastMonthLeaderboard()
    ]);
    
    // Обновляем ленту
    if (feedRes.data) {
      memoryCache.feed = feedRes.data;
      storage.setItem('feed', JSON.stringify(feedRes.data));
    }
    // Обновляем товары
    if (marketRes.data) {
        memoryCache.market = marketRes.data;
        storage.setItem('market', JSON.stringify(marketRes.data));
    }
    // Обновляем лидерборд
    if (leaderboardRes.data) {
        memoryCache.leaderboard = leaderboardRes.data;
        storage.setItem('leaderboard', JSON.stringify(leaderboardRes.data));
    }
    console.log('All data refreshed and saved to storage.');

  } catch (error) {
    console.error('Failed to refresh data:', error);
  }
};

/**
 * Очищает кэш для определенного ключа.
 * Используется после действий, которые делают данные неактуальными (например, покупка).
 * @param {'feed' | 'market' | 'leaderboard' | 'history'} key Ключ данных для очистки.
 */
export const clearCache = (key) => {
  memoryCache[key] = null;
  storage.removeItem(key);
  console.log(`Cache for "${key}" has been cleared.`);
};
