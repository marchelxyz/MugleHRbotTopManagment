// frontend/src/storage.js

// --- ИЗМЕНЯЕМ ИМПОРТЫ: используем Redis API вместо CloudStorage ---
import { getFeed, getMarketItems, getLeaderboard, getUserTransactions, getCache, setCache as setCacheAPI, deleteCache as deleteCacheAPI } from './api';

// Получаем Telegram ID для работы с кешем
const getTelegramId = () => {
    return window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
};

// Fallback на localStorage для случаев, когда Redis недоступен или пользователь не авторизован
const fallbackStorage = {
    getItem: (key) => {
        try {
            const value = localStorage.getItem(`cache_${key}`);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error('Ошибка чтения из localStorage:', error);
            return null;
        }
    },
    setItem: (key, value) => {
        try {
            localStorage.setItem(`cache_${key}`, JSON.stringify(value));
        } catch (error) {
            console.error('Ошибка записи в localStorage:', error);
        }
    },
    removeItem: (key) => {
        try {
            localStorage.removeItem(`cache_${key}`);
        } catch (error) {
            console.error('Ошибка удаления из localStorage:', error);
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
 * Асинхронно получает значение из Redis кеша или fallback хранилища.
 * @param {string} key Ключ, по которому нужно найти данные.
 * @returns {Promise<any|null>} Распарсенный JSON-объект или null.
 */
const getStoredValue = async (key) => {
    const telegramId = getTelegramId();
    
    // Если есть Telegram ID, используем Redis API
    if (telegramId) {
        try {
            const response = await getCache(key);
            if (response.data && response.data.exists && response.data.value !== null) {
                return response.data.value;
            }
        } catch (error) {
            console.warn(`Не удалось получить кеш из Redis для ключа ${key}, используем fallback:`, error);
        }
    }
    
    // Fallback на localStorage
    return fallbackStorage.getItem(key);
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
 * Устанавливает данные в кэш памяти и Redis (с fallback на localStorage).
 * @param {'feed' | 'market' | 'leaderboard' | 'history' | 'banners'} key Ключ данных.
 * @param {any} data Данные для сохранения.
 */
export const setCachedData = async (key, data) => {
    // Обновляем кеш в памяти синхронно
    memoryCache[key] = data;
    
    const telegramId = getTelegramId();
    
    // Если есть Telegram ID, используем Redis API
    if (telegramId && data !== null) {
        try {
            await setCacheAPI(key, data);
        } catch (error) {
            console.warn(`Не удалось сохранить кеш в Redis для ключа ${key}, используем fallback:`, error);
            // Fallback на localStorage
            fallbackStorage.setItem(key, data);
        }
    } else if (data !== null) {
        // Fallback на localStorage если нет Telegram ID
        fallbackStorage.setItem(key, data);
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
      await setCachedData('feed', feedRes.data);
    }
    // Обновляем товары
    if (marketRes.data) {
        memoryCache.market = marketRes.data;
        await setCachedData('market', marketRes.data);
    }
    // Обновляем лидерборд
    if (leaderboardRes.data) {
        memoryCache.leaderboard = leaderboardRes.data;
        await setCachedData('leaderboard', leaderboardRes.data);
    }
    console.log('All data refreshed and saved to storage.');

  } catch (error) {
    console.error('Failed to refresh data:', error);
  }
};

/**
 * Очищает кэш для определенного ключа.
 * Используется после действий, которые делают данные неактуальными (например, покупка).
 * @param {'feed' | 'market' | 'leaderboard' | 'history' | 'banners'} key Ключ данных для очистки.
 */
export const clearCache = async (key) => {
    // Очищаем из памяти
    memoryCache[key] = null;
    
    const telegramId = getTelegramId();
    
    // Если есть Telegram ID, очищаем из Redis
    if (telegramId) {
        try {
            await deleteCacheAPI(key);
            console.log(`Кеш "${key}" очищен из Redis.`);
        } catch (error) {
            console.warn(`Не удалось очистить кеш из Redis для ключа ${key}, используем fallback:`, error);
            // Fallback на localStorage
            fallbackStorage.removeItem(key);
        }
    } else {
        // Fallback на localStorage
        fallbackStorage.removeItem(key);
    }
};
