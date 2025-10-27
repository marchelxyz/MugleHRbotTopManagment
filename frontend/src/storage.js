// frontend/src/storage.js

// --- 1. ИЗМЕНЯЕМ ИМПОРТЫ: убираем старый, добавляем новый ---
import { getFeed, getMarketItems, getLeaderboard, getUserTransactions } from './api';

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
  const [feed, market, leaderboard] = await Promise.all([
    getStoredValue('feed'),
    getStoredValue('market'),
    getStoredValue('leaderboard')
  ]);
  
  memoryCache.feed = feed;
  memoryCache.market = market;
  memoryCache.leaderboard = leaderboard;
  
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
  } catch (error) {
    console.error(`Failed to clear cache for key "${key}":`, error);
  }
};
