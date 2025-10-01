// frontend/src/api.js
import axios from 'axios';

// API_BASE_URL используется только для apiClient, экспортировать его не нужно
const API_BASE_URL = import.meta.env.VITE_API_URL;
console.log('Using API URL:', API_BASE_URL);

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

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

// НОВАЯ ФУНКЦИЯ
export const getAllUsers = (telegramId) => {
  return apiClient.get('/users/', {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

// НОВАЯ ФУНКЦИЯ
export const transferPoints = (transferData) => {
  return apiClient.post('/points/transfer', transferData);
};

export const requestProfileUpdate = (updateData) => {
  const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
  // Вызываем новый эндпоинт, который мы создали в users.py
  return apiClient.post('/users/me/request-update', updateData, {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

export const getFeed = () => apiClient.get('/transactions/feed');

export const getLeaderboard = ({ period, type }) => {
  const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
  // Динамически формируем запрос с параметрами
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

// --- ДОБАВЬ ЭТУ ФУНКЦИЮ ---
export const getLeaderboardStatus = () => {
  const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
  return apiClient.get('/leaderboard/status', {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

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

// Получение активных баннеров для главной страницы
export const getBanners = () => apiClient.get('/banners');

// Получение всех баннеров для админ-панели
export const getAllBanners = () => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.get('/admin/banners', {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

// Создание нового баннера
export const createBanner = (bannerData) => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.post('/admin/banners', bannerData, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

// Обновление баннера
export const updateBanner = (bannerId, bannerData) => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.put(`/admin/banners/${bannerId}`, bannerData, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

// Удаление баннера
export const deleteBanner = (bannerId) => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.delete(`/admin/banners/${bannerId}`, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

// --- НОВЫЕ ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ ТОВАРАМИ ---

// Получение всех активных товаров для админки (может понадобиться)
export const getAllMarketItems = () => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.get('/admin/market-items', { // Предполагаем, что такой эндпоинт есть или будет
        headers: { 'X-Telegram-Id': telegramId },
    });
};

// Обновление товара
export const updateMarketItem = (itemId, itemData) => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.put(`/admin/market-items/${itemId}`, itemData, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

// Архивация (удаление) товара
export const archiveMarketItem = (itemId) => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.delete(`/admin/market-items/${itemId}`, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

// Получение списка архивированных товаров
export const getArchivedMarketItems = () => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.get('/admin/market-items/archived', {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

// Восстановление товара из архива
export const restoreMarketItem = (itemId) => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.post(`/admin/market-items/${itemId}/restore`, {}, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

// --- НОВЫЕ ФУНКЦИИ ДЛЯ РУЛЕТКИ ---

// Собрать части билетиков в целый билет
export const assembleTickets = () => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.post('/roulette/assemble', {}, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

// Прокрутить рулетку
export const spinRoulette = () => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.post('/roulette/spin', {}, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};

// Получить историю последних выигрышей
export const getRouletteHistory = () => apiClient.get('/roulette/history');

// --- НОВАЯ ФУНКЦИЯ ---
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

// --- НОВАЯ ФУНКЦИЯ ДЛЯ ПОИСКА ПОЛЬЗОВАТЕЛЕЙ ---
export const searchUsers = (query) => {
  const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
  // Обращаемся к эндпоинту, который ты уже создал на бэкенде
  return apiClient.get(`/users/search/?query=${query}`, {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

// --- НОВЫЕ ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ ---

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

// --- НОВАЯ ФУНКЦИЯ ДЛЯ СТАТИСТИКИ ---
export const getGeneralStats = (period) => {
    const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
    return apiClient.get(`/admin/statistics/general?period=${period}`, {
        headers: { 'X-Telegram-Id': telegramId },
    });
};
