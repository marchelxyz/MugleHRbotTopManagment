// frontend/src/storage.js

// --- 1. ИЗМЕНЯЕМ ИМПОРТЫ: убираем старый, добавляем новый ---
import { getFeed, getMarketItems, getLeaderboard, getUserTransactions, getCacheItem, setCacheItem, deleteCacheItem } from './api';

// Получаем доступ к API хранилища через Redis на сервере (заменяет Telegram CloudStorage)
const isTelegramWebApp = !!window.Telegram?.WebApp;

// НОВАЯ РЕАЛИЗАЦИЯ: Используем Redis на сервере вместо Telegram CloudStorage
// Это убирает зависимость от соединения Telegram и решает проблему с закрытием приложения
const storage = {
  getItem: (key, callback) => {
    // Обертка для совместимости с callback API
    (async () => {
      try {
        if (isTelegramWebApp) {
          // Используем серверный Redis кеш
          const value = await getCacheItem(key);
          if (callback) callback(null, value ? JSON.stringify(value) : null);
        } else {
          // Fallback на localStorage для веб-браузера
          const value = localStorage.getItem(key);
          if (callback) callback(null, value);
        }
      } catch (error) {
        console.error(`Ошибка при получении из кеша ${key}:`, error);
        // Fallback на localStorage при ошибке
        try {
          const value = localStorage.getItem(key);
          if (callback) callback(null, value);
        } catch (fallbackError) {
          if (callback) callback(fallbackError, null);
        }
      }
    })();
  },
  setItem: (key, value, callback) => {
    // Обертка для совместимости с callback API
    (async () => {
      try {
        if (isTelegramWebApp) {
          // Используем серверный Redis кеш
          const parsedValue = typeof value === 'string' ? JSON.parse(value) : value;
          await setCacheItem(key, parsedValue);
          if (callback) callback(null);
        } else {
          // Fallback на localStorage для веб-браузера
          localStorage.setItem(key, value);
          if (callback) callback(null);
        }
      } catch (error) {
        console.error(`Ошибка при сохранении в кеш ${key}:`, error);
        // Fallback на localStorage при ошибке
        try {
          localStorage.setItem(key, value);
          if (callback) callback(null);
        } catch (fallbackError) {
          if (callback) callback(fallbackError);
        }
      }
    })();
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
 * Асинхронно получает значение из серверного Redis кеша (заменяет Telegram CloudStorage).
 * @param {string} key Ключ, по которому нужно найти данные.
 * @returns {Promise<any|null>} Распарсенный JSON-объект или null.
 */
const getStoredValue = async (key) => {
  try {
    const value = await storage.getItem(key);
    if (!value) {
      return null;
    }
    // Если значение уже объект (из Redis), возвращаем как есть
    if (typeof value === 'object') {
      return value;
    }
    // Если строка - парсим JSON
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        return null;
      }
    }
    return value;
  } catch (error) {
    console.error(`Ошибка при получении значения ${key}:`, error);
    return null;
  }
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
 * Устанавливает данные в кэш памяти и Redis на сервере (заменяет Telegram CloudStorage).
 * @param {'feed' | 'market' | 'leaderboard' | 'history' | 'banners'} key Ключ данных.
 * @param {any} data Данные для сохранения.
 */
export const setCachedData = async (key, data) => {
  memoryCache[key] = data;
  if (data !== null) {
    try {
      await storage.setItem(key, data); // Redis принимает объект напрямую
    } catch (error) {
      console.error(`Ошибка при сохранении кеша ${key}:`, error);
      // Продолжаем работу даже при ошибке кеша
    }
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
      await storage.setItem('feed', feedRes.data);
    }
    // Обновляем товары
    if (marketRes.data) {
        memoryCache.market = marketRes.data;
        await storage.setItem('market', marketRes.data);
    }
    // Обновляем лидерборд
    if (leaderboardRes.data) {
        memoryCache.leaderboard = leaderboardRes.data;
        await storage.setItem('leaderboard', leaderboardRes.data);
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
export const clearCache = async (key) => {
  try {
    // Очищаем из памяти
    memoryCache[key] = null;
    
    // Очищаем из Redis на сервере
    if (isTelegramWebApp) {
      try {
        await deleteCacheItem(key);
      } catch (error) {
        console.warn(`Не удалось очистить кеш ${key} на сервере:`, error);
      }
    }
    
    // Fallback: очищаем из localStorage
    try {
      localStorage.removeItem(key);
    } catch (error) {
      // Игнорируем ошибки localStorage
    }
    
    console.log(`Cache for "${key}" has been cleared.`);
  } catch (error) {
    console.error(`Failed to clear cache for key "${key}":`, error);
  }
};
