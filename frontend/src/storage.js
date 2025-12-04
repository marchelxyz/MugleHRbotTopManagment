// frontend/src/storage.js

// --- 1. ИЗМЕНЯЕМ ИМПОРТЫ: убираем старый, добавляем новый ---
import { getFeed, getMarketItems, getLeaderboard, getUserTransactions } from './api';

// Получаем доступ к API хранилища (с проверкой поддержки)
const storage = window.Telegram?.WebApp?.CloudStorage;
// Проверяем не только наличие объекта, но и версию API (CloudStorage доступен с версии 6.1+)
const webAppVersion = window.Telegram?.WebApp?.version;
const isCloudStorageSupported = !!storage && webAppVersion && parseFloat(webAppVersion) >= 6.1;

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
    // Проверяем поддержку CloudStorage перед использованием
    if (!isCloudStorageSupported || !storage) {
      resolve(null);
      return;
    }
    try {
      // Проверяем, что метод getItem существует и является функцией
      if (typeof storage.getItem !== 'function') {
        resolve(null);
        return;
      }
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
    } catch (error) {
      // Если CloudStorage не поддерживается или произошла ошибка, возвращаем null
      // Не логируем ошибку, так как это ожидаемое поведение вне Telegram
      resolve(null);
    }
  });
};

/**
 * Инициализирует кэш при запуске приложения.
 * Загружает данные из локального хранилища в память для быстрого доступа.
 */
export const initializeCache = async () => {
  console.log('Initializing local storage cache...');
  
  try {
    const [feed, market, leaderboard, banners] = await Promise.all([
      getStoredValue('feed').catch(() => null),
      getStoredValue('market').catch(() => null),
      getStoredValue('leaderboard').catch(() => null),
      getStoredValue('banners').catch(() => null)
    ]);
    
    memoryCache.feed = feed;
    memoryCache.market = market;
    memoryCache.leaderboard = leaderboard;
    memoryCache.banners = banners;

    console.log('Cache initialized from local storage:', memoryCache);
  } catch (error) {
    // Игнорируем ошибки инициализации кэша - это не критично
    console.debug('Cache initialization completed with warnings (expected outside Telegram)');
  }
  
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
  if (data !== null && isCloudStorageSupported) {
    try {
      // Проверяем, что метод доступен перед вызовом
      if (storage && typeof storage.setItem === 'function') {
        storage.setItem(key, JSON.stringify(data));
      }
    } catch (error) {
      console.warn('Не удалось сохранить в CloudStorage:', error);
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
      if (isCloudStorageSupported && storage && typeof storage.setItem === 'function') {
        try {
          storage.setItem('feed', JSON.stringify(feedRes.data));
        } catch (error) {
          console.warn('Не удалось сохранить feed в CloudStorage:', error);
        }
      }
    }
    // Обновляем товары
    if (marketRes.data) {
        memoryCache.market = marketRes.data;
        if (isCloudStorageSupported && storage && typeof storage.setItem === 'function') {
          try {
            storage.setItem('market', JSON.stringify(marketRes.data));
          } catch (error) {
            console.warn('Не удалось сохранить market в CloudStorage:', error);
          }
        }
    }
    // Обновляем лидерборд
    if (leaderboardRes.data) {
        memoryCache.leaderboard = leaderboardRes.data;
        if (isCloudStorageSupported && storage && typeof storage.setItem === 'function') {
          try {
            storage.setItem('leaderboard', JSON.stringify(leaderboardRes.data));
          } catch (error) {
            console.warn('Не удалось сохранить leaderboard в CloudStorage:', error);
          }
        }
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
