// frontend/src/api.js
import axios from 'axios';

// API_BASE_URL используется только для apiClient, экспортировать его не нужно
const API_BASE_URL = import.meta.env.VITE_API_URL;
console.log('Using API URL:', API_BASE_URL);

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// --- Существующие функции (без изменений) ---

export const checkUserStatus = (telegramId) => {
  return apiClient.get('/users/me', {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

export const registerUser = (telegramId, userData) => {
  return apiClient.post('/users/auth/register', userData, {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

export const getAllUsers = (telegramId) => {
  return apiClient.get('/users/', {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

export const transferPoints = (transferData) => {
  return apiClient.post('/points/transfer', transferData);
};

export const requestProfileUpdate = (updateData) => {
  const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
  return apiClient.post('/users/me/request-update', updateData, {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

export const getFeed = () => apiClient.get('/transactions/feed');

export const getLeaderboard = ({ period, type }) => {
  const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
  return apiClient.get(`/leaderboard/?period=${period}&type=${type}`, {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

export const getMyRank = ({ period, type }) => {
  const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
  return apiClient.get(`/leaderboard/my-rank?period=${period}&type=${type}`, {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

export const getLeaderboardStatus = () => {
  const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
  return apiClient.get('/leaderboard/status', {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

export const getMarketItems = () => apiClient.get('/market/items');

export const purchaseItem = (userId, itemId) => {
  // Убедись, что user_id здесь это telegram_id
  return apiClient.post('/market/purchase/', { user_id: userId, item_id: itemId });
};

export const getUserTransactions = (userId) => {
  return apiClient.get(`/users/${userId}/transactions`);
};

export const addPointsToAll = (data) => {
  const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
  return apiClient.post('/admin/add-points', data, {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

export const createMarketItem = (itemData) => {
  const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
  return apiClient.post('/admin/market-items', itemData, {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

export const getBanners = () => apiClient.get('/banners');

export const getAllBanners = () => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.get('/admin/banners', {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

export const createBanner = (bannerData) => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.post('/admin/banners', bannerData, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

export const updateBanner = (bannerId, bannerData) => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.put(`/admin/banners/${bannerId}`, bannerData, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

export const deleteBanner = (bannerId) => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.delete(`/admin/banners/${bannerId}`, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

export const getAllMarketItems = () => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.get('/admin/market-items', {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

export const updateMarketItem = (itemId, itemData) => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;  
    return apiClient.put(`/admin/market-items/${itemId}`, itemData, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

export const archiveMarketItem = (itemId) => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.delete(`/admin/market-items/${itemId}`, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

export const getArchivedMarketItems = () => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.get('/admin/market-items/archived', {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

export const restoreMarketItem = (itemId) => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.post(`/admin/market-items/${itemId}/restore`, {}, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

export const assembleTickets = () => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.post('/roulette/assemble', {}, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

export const spinRoulette = () => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.post('/roulette/spin', {}, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

export const getRouletteHistory = () => apiClient.get('/roulette/history');

export const addTicketsToAll = (data) => {
  const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
  return apiClient.post('/admin/add-tickets', data, {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

export const resetDailyTransferLimits = () => {
  const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
  return apiClient.post('/admin/reset-daily-transfer-limits', {}, {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

export const deleteUserCard = () => {
  const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
  return apiClient.delete('/users/me/card', {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

export const searchUsers = (query) => {
  const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
  return apiClient.get(`/users/search/?query=${query}`, {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

export const adminGetAllUsers = () => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.get('/admin/users', {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

export const adminUpdateUser = (userId, userData) => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.put(`/admin/users/${userId}`, userData, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

export const adminDeleteUser = (userId) => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.delete(`/admin/users/${userId}`, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

// --- ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ УЧЕТНЫМИ ДАННЫМИ ---
export const setUserCredentials = (userId, credentials) => {
    const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!telegramId) {
      return Promise.reject(new Error('Telegram ID не найден'));
    }
    return apiClient.post(`/admin/users/${userId}/set-credentials`, credentials, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

export const bulkSendCredentials = (requestData) => {
    const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!telegramId) {
      return Promise.reject(new Error('Telegram ID не найден'));
    }
    return apiClient.post('/admin/users/bulk-send-credentials', requestData, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

// --- НОВЫЕ ФУНКЦИИ ДЛЯ СТАТИСТИКИ АДМИН-ПАНЕЛИ ---

const getAdminHeaders = () => ({
  headers: { 'X-Telegram-Id': window.Telegram.WebApp.initDataUnsafe?.user?.id },
});

// Добавляем startDate и endDate в параметры
export const getGeneralStats = (startDate, endDate) => {
    // Формируем строку с параметрами
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    return apiClient.get(`/admin/statistics/general?${params.toString()}`, getAdminHeaders());
};

export const getHourlyActivityStats = (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

  return apiClient.get(`/admin/statistics/hourly_activity?${params.toString()}`, getAdminHeaders());
};

export const getUserEngagementStats = () => {
  return apiClient.get('/admin/statistics/user_engagement', getAdminHeaders());
};

export const getPopularItemsStats = () => {
  return apiClient.get('/admin/statistics/popular_items', getAdminHeaders());
};

export const getInactiveUsers = () => {
  return apiClient.get('/admin/statistics/inactive_users', getAdminHeaders());
};

export const getTotalBalance = () => {
  return apiClient.get('/admin/statistics/total_balance', getAdminHeaders());
};

export const getLoginActivityStats = (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    return apiClient.get(`/admin/statistics/login_activity?${params.toString()}`, getAdminHeaders());
};

export const getActiveUserRatio = () => {
    return apiClient.get('/admin/statistics/active_user_ratio', getAdminHeaders());
};

// --- НОВЫЙ БЛОК ДЛЯ ЭКСПОРТА ---

export const exportUserEngagement = () => {
    return apiClient.get('/admin/statistics/user_engagement/export', {
        ...getAdminHeaders(), // Добавляем заголовки аутентификации
        responseType: 'blob', // <-- ВАЖНО: указываем, что мы ожидаем файл
    });
};

// --- ВЫГРУЗКА СВОДНОГО ОТЧЕТА ---
export const exportConsolidatedReport = (startDate, endDate) => {
    // Формируем строку с параметрами дат
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    return apiClient.get(`/admin/statistics/export/consolidated?${params.toString()}`, {
        ...getAdminHeaders(),
        responseType: 'blob', // Указываем, что ждем файл
    });
};

// --- ВЫГРУЗКА ВСЕГО СПИСКА ПОЛЬЗОВАТЕЛЕЙ ---
export const exportAllUsers = () => {
    return apiClient.get('/admin/users/export', {
        ...getAdminHeaders(),
        responseType: 'blob', // Указываем, что ждем файл
    });
};

// --- НОВЫЕ ФУНКЦИИ ДЛЯ РАБОТЫ С СЕССИЯМИ ---

export const startSession = () => {
  const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
  // Отправляем POST-запрос для создания новой сессии
  return apiClient.post('/sessions/start', {}, {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

export const pingSession = (sessionId) => {
  const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
  // Отправляем PUT-запрос для обновления существующей сессии
  return apiClient.put(`/sessions/ping/${sessionId}`, {}, {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

export const getAverageSessionDuration = (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    return apiClient.get(`/admin/statistics/average_session_duration?${params.toString()}`, getAdminHeaders());
};

// --- ОБУЧАЮЩИЕ ИСТОРИИ ---
export const completeOnboarding = () => {
  const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
  return apiClient.post('/users/me/complete-onboarding', {}, {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

export const deleteMarketItemPermanently = (itemId) => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.delete(`/admin/market-items/${itemId}/permanent`, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

// --- API ФУНКЦИИ ДЛЯ STATIX BONUS ---
export const getStatixBonusItem = () => {
    return apiClient.get('/market/statix-bonus');
};

export const purchaseStatixBonus = (telegramId, bonusAmount) => {
    return apiClient.post('/market/statix-bonus/purchase', {
        user_id: telegramId,
        bonus_amount: bonusAmount
    }, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

// --- АДМИН API ДЛЯ STATIX BONUS ---
export const getStatixBonusSettings = () => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.get('/admin/statix-bonus', {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

export const updateStatixBonusSettings = (settings) => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.put('/admin/statix-bonus', settings, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

export const adminGenerateLeaderboardBanners = () => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.post('/admin/generate-leaderboard-banners', {}, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

// --- НОВАЯ ФУНКЦИЯ ДЛЯ ТЕСТИРОВАНИЯ ---
export const adminGenerateTestLeaderboardBanners = () => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.post('/admin/generate-test-banners', {}, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

// --- API ДЛЯ СОВМЕСТНЫХ ПОДАРКОВ ---
export const createSharedGiftInvitation = (invitationData) => {
    return apiClient.post('/shared-gifts/invite', invitationData);
};

export const getUserSharedGiftInvitations = (userId, status = null) => {
    const params = status ? `?status=${status}` : '';
    return apiClient.get(`/shared-gifts/invitations/${userId}${params}`);
};

export const acceptSharedGiftInvitation = (invitationId, userId) => {
    return apiClient.post('/shared-gifts/accept', {
        invitation_id: invitationId,
        user_id: userId
    });
};

export const rejectSharedGiftInvitation = (invitationId, userId) => {
    return apiClient.post('/shared-gifts/reject', {
        invitation_id: invitationId,
        user_id: userId
    });
};

export const cleanupExpiredSharedGiftInvitations = () => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.post('/shared-gifts/cleanup', {}, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

// --- API ФУНКЦИИ ДЛЯ РАБОТЫ С КЕШЕМ (заменяют Telegram CloudStorage) ---
export const getCacheItem = (key) => {
    const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!telegramId) {
        return Promise.reject(new Error('Telegram ID не найден'));
    }
    return apiClient.get(`/cache/${key}`, {
        headers: { 'X-Telegram-Id': telegramId },
    }).then(response => response.data.value)
      .catch(error => {
          // Если ключ не найден (404), возвращаем null (как в CloudStorage)
          if (error.response && error.response.status === 404) {
              return null;
          }
          throw error;
      });
};

export const setCacheItem = (key, value) => {
    const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!telegramId) {
        return Promise.reject(new Error('Telegram ID не найден'));
    }
    return apiClient.put(`/cache/${key}`, value, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

export const deleteCacheItem = (key) => {
    const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!telegramId) {
        return Promise.reject(new Error('Telegram ID не найден'));
    }
    return apiClient.delete(`/cache/${key}`, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

export const clearAllCache = () => {
    const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!telegramId) {
        return Promise.reject(new Error('Telegram ID не найден'));
    }
    return apiClient.delete('/cache/', {
        headers: { 'X-Telegram-Id': telegramId },
    });
};
