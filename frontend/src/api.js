import axios from 'axios';

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
export const transferPoints = (telegramId, transferData) => {
  return apiClient.post('/points/transfer', transferData, {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

export const getFeed = () => apiClient.get('/transactions/feed');
export const getLastMonthLeaderboard = () => apiClient.get('/leaderboard/last-month');
