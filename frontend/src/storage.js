// frontend/src/storage.js

// --- ИЗМЕНЯЕМ ИМПОРТЫ: используем Redis API вместо CloudStorage ---
import { getFeed, getMarketItems, getLeaderboard, getCache, setCache as setCacheAPI, deleteCache as deleteCacheAPI } from './api';

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
 * Оптимизировано для параллельной загрузки и неблокирующего UI.
 */
export const initializeCache = async () => {
  console.log('Initializing cache...');
  
  try {
    // 1. Параллельная загрузка всех данных из кеша (быстро, не блокирует UI)
    const [feed, market, leaderboard, banners] = await Promise.all([
      getStoredValue('feed').catch(() => null),
      getStoredValue('market').catch(() => null),
      getStoredValue('leaderboard').catch(() => null),
      getStoredValue('banners').catch(() => null)
    ]);
    
    // 2. Заполняем memory cache синхронно (мгновенный доступ)
    memoryCache.feed = feed;
    memoryCache.market = market;
    memoryCache.leaderboard = leaderboard;
    memoryCache.banners = banners;

    console.log('Cache initialized from storage');
    
    // 3. Обновляем данные в фоне (не блокирует UI)
    // Используем setTimeout для отложенного запуска, чтобы не мешать первоначальной загрузке
    setTimeout(() => {
      refreshAllData().catch(err => {
        console.warn('Background cache refresh failed:', err);
      });
    }, 100); // Небольшая задержка для приоритизации критических запросов
    
  } catch (error) {
    console.error('Cache initialization failed:', error);
    // Продолжаем работу даже при ошибке инициализации кеша
  }
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
 * Оптимизировано для параллельной загрузки и обработки ошибок.
 */
export const refreshAllData = async () => {
  console.log('Refreshing all data from API...');
  try {
    // Параллельная загрузка всех данных с сервера
    const [feedRes, marketRes, leaderboardRes] = await Promise.allSettled([
      getFeed(),
      getMarketItems(),
      getLeaderboard({ period: 'current_month', type: 'received' })
    ]);
    
    // Обрабатываем результаты независимо (если один запрос упал, остальные сохраняются)
    const updatePromises = [];
    
    if (feedRes.status === 'fulfilled' && feedRes.value?.data) {
      memoryCache.feed = feedRes.value.data;
      updatePromises.push(setCachedData('feed', feedRes.value.data).catch(err => 
        console.warn('Failed to cache feed:', err)
      ));
    } else if (feedRes.status === 'rejected') {
      console.warn('Failed to refresh feed:', feedRes.reason);
    }
    
    if (marketRes.status === 'fulfilled' && marketRes.value?.data) {
      memoryCache.market = marketRes.value.data;
      updatePromises.push(setCachedData('market', marketRes.value.data).catch(err => 
        console.warn('Failed to cache market:', err)
      ));
    } else if (marketRes.status === 'rejected') {
      console.warn('Failed to refresh market:', marketRes.reason);
    }
    
    if (leaderboardRes.status === 'fulfilled' && leaderboardRes.value?.data) {
      memoryCache.leaderboard = leaderboardRes.value.data;
      updatePromises.push(setCachedData('leaderboard', leaderboardRes.value.data).catch(err => 
        console.warn('Failed to cache leaderboard:', err)
      ));
    } else if (leaderboardRes.status === 'rejected') {
      console.warn('Failed to refresh leaderboard:', leaderboardRes.reason);
    }
    
    // Сохраняем кеш параллельно
    await Promise.all(updatePromises);
    
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
