import axios from 'axios';
import { getToken, removeToken } from './storage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
        const initData = new URLSearchParams(window.Telegram.WebApp.initData);
        const authData = initData.get('user');
        if (authData) {
          config.headers['Telegram-Auth'] = authData;
        }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      removeToken();
    }
    return Promise.reject(error);
  }
);

// --- Основные функции ---
export const getMe = async () => {
  const response = await axiosInstance.get('/users/me');
  return response.data;
};

export const registerUser = async (userData) => {
  const response = await axiosInstance.post('/users/register', userData);
  return response.data;
};

export const updateUser = async (userId, userData) => {
  const response = await axiosInstance.put(`/users/${userId}`, userData);
  return response.data;
};

export const getFeed = async () => {
  const response = await axiosInstance.get('/feed');
  return response.data;
};

export const getLeaderboard = async () => {
  const response = await axiosInstance.get('/leaderboard');
  return response.data;
};

export const transferThanks = async (transferData) => {
  const response = await axiosInstance.post('/transactions/transfer', transferData);
  return response.data;
};

export const getMarketItems = async () => {
  const response = await axiosInstance.get('/market/items');
  return response.data;
};

export const purchaseItem = async (purchaseData) => {
  const response = await axiosInstance.post('/market/purchase', purchaseData);
  return response.data;
};

export const getUserHistory = async (userId) => {
  const response = await axiosInstance.get(`/users/${userId}/history`);
  return response.data;
};

export const getMyRank = async () => {
    const response = await axiosInstance.get(`/users/me/rank`);
    return response.data;
};

// --- Функции для рулетки ---
export const spinRoulette = async () => {
  const response = await axiosInstance.post('/roulette/spin');
  return response.data;
};

export const assembleTickets = async () => {
  const response = await axiosInstance.post('/roulette/assemble_tickets');
  return response.data;
};

export const getRouletteHistory = async () => {
  const response = await axiosInstance.get('/roulette/history');
  return response.data;
};

// --- Админ-панель (Общее) ---
export const getUsersForAdmin = async () => {
  const response = await axiosInstance.get('/admin/users');
  return response.data;
};

export const updateUserForAdmin = async (userId, userData) => {
  const response = await axiosInstance.put(`/admin/users/${userId}`, userData);
  return response.data;
};

// --- Админ-панель (Статистика) ---
export const getGeneralStats = async (period) => {
    const response = await axiosInstance.get(`/admin/statistics/general?period=${period}`);
    return response.data;
};

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
