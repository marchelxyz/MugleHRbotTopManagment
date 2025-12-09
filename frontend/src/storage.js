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
  banners: null,
};

// Лимит размера для Telegram Cloud Storage (примерно 64KB, используем 60KB для безопасности)
const CLOUD_STORAGE_MAX_SIZE = 60 * 1024; // 60KB в байтах

// Инициализация IndexedDB для больших данных
let dbInstance = null;

const initIndexedDB = () => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open('TelegramWebAppCache', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('largeData')) {
        db.createObjectStore('largeData', { keyPath: 'key' });
      }
    };
  });
};

// Сохранение больших данных в IndexedDB
const saveToIndexedDB = async (key, data) => {
  try {
    const db = await initIndexedDB();
    const transaction = db.transaction(['largeData'], 'readwrite');
    const store = transaction.objectStore('largeData');
    
    return new Promise((resolve, reject) => {
      const request = store.put({ key, data, timestamp: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`Failed to save ${key} to IndexedDB:`, error);
    throw error;
  }
};

// Получение больших данных из IndexedDB
const getFromIndexedDB = async (key) => {
  try {
    const db = await initIndexedDB();
    const transaction = db.transaction(['largeData'], 'readonly');
    const store = transaction.objectStore('largeData');
    const request = store.get(key);
    
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : null);
      };
      request.onerror = () => resolve(null);
    });
  } catch (error) {
    console.error(`Failed to get ${key} from IndexedDB:`, error);
    return null;
  }
};

// Безопасное сохранение данных с проверкой размера
const safeSetItem = async (key, data) => {
  const jsonString = JSON.stringify(data);
  const sizeInBytes = new Blob([jsonString]).size;
  
  // Если данные меньше лимита, сохраняем в Cloud Storage
  if (sizeInBytes <= CLOUD_STORAGE_MAX_SIZE) {
    return new Promise((resolve) => {
      storage.setItem(key, jsonString, (error) => {
        if (error) {
          console.warn(`Failed to save ${key} to Cloud Storage (${sizeInBytes} bytes), using IndexedDB:`, error);
          // Fallback на IndexedDB при ошибке
          saveToIndexedDB(key, data).then(() => resolve());
        } else {
          resolve();
        }
      });
    });
  } else {
    // Данные слишком большие, сохраняем только в IndexedDB
    console.warn(`Data for ${key} is too large (${sizeInBytes} bytes), saving to IndexedDB only`);
    await saveToIndexedDB(key, data);
    // Помечаем в Cloud Storage, что данные хранятся в IndexedDB
    storage.setItem(`${key}_source`, 'indexeddb', () => {});
  }
};

// Безопасное получение данных с проверкой источника
const safeGetItem = async (key) => {
  // Сначала проверяем Cloud Storage
  return new Promise((resolve) => {
    storage.getItem(`${key}_source`, (error, source) => {
      if (source === 'indexeddb') {
        // Данные хранятся в IndexedDB
        getFromIndexedDB(key).then(resolve);
      } else {
        // Пытаемся получить из Cloud Storage
        storage.getItem(key, (error, value) => {
          if (error || !value) {
            // Fallback на IndexedDB
            getFromIndexedDB(key).then(resolve);
          } else {
            try {
              resolve(JSON.parse(value));
            } catch (e) {
              console.error(`Failed to parse ${key} from Cloud Storage:`, e);
              getFromIndexedDB(key).then(resolve);
            }
          }
        });
      }
    });
  });
};

/**
 * Асинхронно получает значение из локального хранилища TWA.
 * Использует безопасное получение с поддержкой IndexedDB для больших данных.
 * @param {string} key Ключ, по которому нужно найти данные.
 * @returns {Promise<any|null>} Распарсенный JSON-объект или null.
 */
const getStoredValue = async (key) => {
  try {
    const value = await safeGetItem(key);
    return value;
  } catch (error) {
    console.error(`Error getting stored value for ${key}:`, error);
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
 * Устанавливает данные в кэш памяти и CloudStorage (или IndexedDB для больших данных).
 * @param {'feed' | 'market' | 'leaderboard' | 'history' | 'banners'} key Ключ данных.
 * @param {any} data Данные для сохранения.
 */
export const setCachedData = async (key, data) => {
  memoryCache[key] = data;
  if (data !== null) {
    try {
      await safeSetItem(key, data);
    } catch (error) {
      console.error(`Failed to save ${key} to storage:`, error);
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
    
    // Обновляем ленту с безопасным сохранением
    if (feedRes.data) {
      memoryCache.feed = feedRes.data;
      await safeSetItem('feed', feedRes.data);
    }
    // Обновляем товары с безопасным сохранением
    if (marketRes.data) {
        memoryCache.market = marketRes.data;
        await safeSetItem('market', marketRes.data);
    }
    // Обновляем лидерборд с безопасным сохранением
    if (leaderboardRes.data) {
        memoryCache.leaderboard = leaderboardRes.data;
        await safeSetItem('leaderboard', leaderboardRes.data);
    }
    console.log('All data refreshed and saved to storage.');

  } catch (error) {
    console.error('Failed to refresh data:', error);
  }
};

/**
 * Очищает кэш для определенного ключа из памяти, Cloud Storage и IndexedDB.
 * Используется после действий, которые делают данные неактуальными (например, покупка).
 * @param {'feed' | 'market' | 'leaderboard' | 'history' | 'banners'} key Ключ данных для очистки.
 */
export const clearCache = async (key) => {
  try {
    // Очищаем из памяти
    memoryCache[key] = null;
    
    // Очищаем из Cloud Storage
    storage.removeItem(key, () => {});
    storage.removeItem(`${key}_source`, () => {});
    
    // Очищаем из IndexedDB
    try {
      const db = await initIndexedDB();
      const transaction = db.transaction(['largeData'], 'readwrite');
      const store = transaction.objectStore('largeData');
      
      await new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn(`Failed to clear ${key} from IndexedDB:`, error);
    }
    
    console.log(`Cache for "${key}" has been cleared.`);
  } catch (error) {
    console.error(`Failed to clear cache for key "${key}":`, error);
  }
};
