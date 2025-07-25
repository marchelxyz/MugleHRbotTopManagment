import axios from 'axios';

// --- НАША ОТЛАДОЧНАЯ СТРОКА ---
console.log('Using API URL:', import.meta.env.VITE_API_URL);

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

export const checkUserStatus = (telegramId) => {
  return apiClient.get('/users/me', {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

export const registerUser = (telegramId, userData) => {
  return apiClient.post('/auth/register', userData, {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

// НОВАЯ ФУНКЦИЯ
export const getAllUsers = (telegramId) => {
  return apiClient.get('/users', {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

// НОВАЯ ФУНКЦИЯ
export const transferPoints = (transferData) => {
  return apiClient.post('/points/transfer', transferData);
};

export const getFeed = () => apiClient.get('/transactions/feed');
export const getLastMonthLeaderboard = () => apiClient.get('/leaderboard/last-month');
export const getMarketItems = () => apiClient.get('/market/items');
export const purchaseItem = (userId, itemId) => {
  // Отправляем и ID пользователя, и ID товара в теле запроса
  return apiClient.post('/market/purchase', { user_id: userId, item_id: itemId });
};

export const getUserTransactions = (userId) => {
  return apiClient.get(`/users/${userId}/transactions`);
};

export const addPointsToAll = (data) => {
  // Получаем telegramId из объекта WebApp для отправки в заголовке
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
