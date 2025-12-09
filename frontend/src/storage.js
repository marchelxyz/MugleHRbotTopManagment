// frontend/src/storage.js

// --- 1. ИЗМЕНЯЕМ ИМПОРТЫ: убираем старый, добавляем новый ---
import { getFeed, getMarketItems, getLeaderboard, getUserTransactions } from './api';

// Получаем доступ к API хранилища с fallback на localStorage
const isTelegramWebApp = !!window.Telegram?.WebApp;
const storage = isTelegramWebApp ? window.Telegram.WebApp.CloudStorage : {
  getItem: (key, callback) => {
    try {
      const value = localStorage.getItem(key);
      callback(null, value);
    } catch (error) {
      callback(error, null);
    }
  },
  setItem: (key, value, callback) => {
    try {
      localStorage.setItem(key, value);
      if (callback) callback(null);
    } catch (error) {
      if (callback) callback(error);
    }
  }
};

// Локальная переменная для мгновенного доступа после первой загрузки
const memoryCache = {
  feed: null,
  market: null,
  leaderboard: null,
  history: null,
  banners: null,
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
  
  const [feed, market, leaderboard, banners] = await Promise.all([
    getStoredValue('feed'),
    getStoredValue('market'),
    getStoredValue('leaderboard'),
    getStoredValue('banners')
  ]);
  
  memoryCache.feed = feed;
  memoryCache.market = market;
  memoryCache.leaderboard = leaderboard;
  memoryCache.banners = banners;

  console.log('Cache initialized from local storage:', memoryCache);
  
  // После инициализации, асинхронно обновляем данные с сервера
  refreshAllData();
};

/**
 * Получает данные из кэша в памяти (синхронно).
 * @param {'feed' | 'market' | 'leaderboard' | 'history' | 'banners'} key Ключ данных.
 */
export const getCachedData = (key) => {
  return memoryCache[key];
};

/**
 * Устанавливает данные в кэш памяти и CloudStorage.
 * @param {'feed' | 'market' | 'leaderboard' | 'history' | 'banners'} key Ключ данных.
 * @param {any} data Данные для сохранения.
 */
export const setCachedData = (key, data) => {
  memoryCache[key] = data;
  if (data !== null) {
    storage.setItem(key, JSON.stringify(data));
  }
};

/**
 * Полностью обновляет все кэшируемые данные, запрашивая их с сервера
 * и сохраняя как в локальное хранилище, так и в память.
 */
export const refreshAllData = async () => {
  console.log('Refreshing all data from API...');
  try {
    // --- 2. ГЛАВНОЕ ИЗМЕНЕНИЕ: Заменяем вызов функции ---
    const [feedRes, marketRes, leaderboardRes] = await Promise.all([
      getFeed(),
      getMarketItems(),
      // Было: getLastMonthLeaderboard()
      // Стало:
      getLeaderboard({ period: 'current_month', type: 'received' })
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
  try {
    const cacheKey = `cache_${key}`;
    localStorage.removeItem(cacheKey); // Используем removeItem для надежности
    console.log(`Cache for "${key}" has been cleared.`); // Добавляем лог для проверки
  } catch (error) {
    console.error(`Failed to clear cache for key "${key}":`, error);
  }
};
