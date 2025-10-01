import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// --- ГЛАВНОЕ ИСПРАВЛЕНИЕ: Добавляем "перехватчик" запросов ---
// Этот код будет выполняться ПЕРЕД КАЖДЫМ запросом, отправляемым через apiClient
apiClient.interceptors.request.use(
  (config) => {
    // Получаем ID пользователя прямо перед отправкой запроса
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    if (telegramId) {
      // Если ID есть, добавляем его в заголовки
      config.headers['X-Telegram-Id'] = telegramId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- Теперь можно упростить все остальные функции, убрав из них заголовки ---

export const checkUserStatus = () => {
  return apiClient.get('/users/me');
};

export const registerUser = (userData) => {
  return apiClient.post('/users/auth/register', userData);
};

export const transferPoints = (transferData) => {
  return apiClient.post('/points/transfer', transferData);
};

export const requestProfileUpdate = (updateData) => {
  return apiClient.post('/users/me/request-update', updateData);
};

export const getFeed = () => apiClient.get('/transactions/feed');

export const getLeaderboard = ({ period, type }) => {
  return apiClient.get(`/leaderboard/?period=${period}&type=${type}`);
};

export const getMyRank = ({ period, type }) => {
  return apiClient.get(`/leaderboard/my-rank?period=${period}&type=${type}`);
};

export const getLeaderboardStatus = () => {
  return apiClient.get('/leaderboard/status');
};

export const getMarketItems = () => apiClient.get('/market/items');

export const purchaseItem = (userId, itemId) => {
  return apiClient.post('/market/purchase', { user_id: userId, item_id: itemId });
};

export const getUserTransactions = (userId) => {
  return apiClient.get(`/users/${userId}/transactions`);
};

// --- АДМИН-ФУНКЦИИ ---

export const addPointsToAll = (data) => {
  return apiClient.post('/admin/add-points', data);
};

export const createMarketItem = (itemData) => {
  return apiClient.post('/admin/market-items', itemData);
};

export const getBanners = () => apiClient.get('/banners');

export const getAllBanners = () => {
    return apiClient.get('/admin/banners');
};

export const createBanner = (bannerData) => {
    return apiClient.post('/admin/banners', bannerData);
};

export const updateBanner = (bannerId, bannerData) => {
    return apiClient.put(`/admin/banners/${bannerId}`, bannerData);
};

export const deleteBanner = (bannerId) => {
    return apiClient.delete(`/admin/banners/${bannerId}`);
};

export const getAllMarketItems = () => {
    return apiClient.get('/admin/market-items');
};

export const updateMarketItem = (itemId, itemData) => {
    return apiClient.put(`/admin/market-items/${itemId}`, itemData);
};

export const archiveMarketItem = (itemId) => {
    return apiClient.delete(`/admin/market-items/${itemId}`);
};

export const getArchivedMarketItems = () => {
    return apiClient.get('/admin/market-items/archived');
};

export const restoreMarketItem = (itemId) => {
    return apiClient.post(`/admin/market-items/${itemId}/restore`, {});
};

export const assembleTickets = () => {
    return apiClient.post('/roulette/assemble', {});
};

export const spinRoulette = () => {
    return apiClient.post('/roulette/spin', {});
};

export const getRouletteHistory = () => apiClient.get('/roulette/history');

export const addTicketsToAll = (data) => {
  return apiClient.post('/admin/add-tickets', data);
};

export const deleteUserCard = () => {
  return apiClient.delete('/users/me/card');
};

export const searchUsers = (query) => {
  return apiClient.get(`/users/search/?query=${query}`);
};

export const adminGetAllUsers = () => {
    return apiClient.get('/admin/users');
};

export const adminUpdateUser = (userId, userData) => {
    return apiClient.put(`/admin/users/${userId}`, userData);
};

export const adminDeleteUser = (userId) => {
    return apiClient.delete(`/admin/users/${userId}`);
};

// Функция для статистики (теперь тоже работает через перехватчик)
export const getGeneralStats = (period) => {
    return apiClient.get(`/admin/statistics/general?period=${period}`);
};

// --- НАШИ НОВЫЕ ФУНКЦИИ ДЛЯ СТАТИСТИКИ ---

export const getHourlyActivityStats = async () => {
  const response = await axiosInstance.get('/admin/statistics/hourly_activity');
  return response.data;
};

export const getUserEngagementStats = async () => {
  const response = await axiosInstance.get('/admin/statistics/user_engagement');
  return response.data;
};

export const getPopularItemsStats = async () => {
  const response = await axiosInstance.get('/admin/statistics/popular_items');
  return response.data;
};

export const getInactiveUsers = async () => {
  const response = await axiosInstance.get('/admin/statistics/inactive_users');
  return response.data;
};

export const getTotalBalance = async () => {
  const response = await axiosInstance.get('/admin/statistics/total_balance');
  return response.data;
};

export default axiosInstance;
