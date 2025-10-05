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
  return apiClient.post('/market/purchase', { user_id: userId, item_id: itemId });
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
