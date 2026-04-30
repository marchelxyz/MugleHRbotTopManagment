// frontend/src/api.js
import axios from 'axios';
import {
  ADMIN_PANEL_TOKEN_KEY,
  ADMIN_PANEL_USER_KEY,
} from './constants/adminPanelStorage.js';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

/**
 * Возвращает заголовки авторизации (X-Telegram-Id или X-User-Id).
 * В Telegram WebApp использует telegram user id, в браузере — userId из localStorage.
 */
export function getAuthHeaders() {
  const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  if (telegramId != null && telegramId !== '') {
    return { headers: { 'X-Telegram-Id': String(telegramId) } };
  }
  const adminPanelToken = localStorage.getItem(ADMIN_PANEL_TOKEN_KEY);
  if (adminPanelToken) {
    return { headers: { Authorization: `Bearer ${adminPanelToken}` } };
  }
  const userId = localStorage.getItem('userId');
  if (userId) {
    return { headers: { 'X-User-Id': userId } };
  }
  return {};
}

// Интерсептор: на каждый запрос подставляем авторизацию (Mini App часто монтируется до стабильного initData).
apiClient.interceptors.request.use(
  (config) => {
    const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (tgId != null && tgId !== '' && !config.headers['X-Telegram-Id']) {
      config.headers['X-Telegram-Id'] = String(tgId);
    }
    const userId = localStorage.getItem('userId');
    if (userId && !config.headers['X-Telegram-Id'] && !config.headers['X-User-Id']) {
      config.headers['X-User-Id'] = userId;
    }
    const adminPanelToken = localStorage.getItem(ADMIN_PANEL_TOKEN_KEY);
    if (adminPanelToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${adminPanelToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- Существующие функции (без изменений) ---

// --- ФУНКЦИЯ ДЛЯ ВХОДА ЧЕРЕЗ БРАУЗЕР / ПРИВЯЗКИ TELEGRAM ---
export const loginUser = (login, password, telegramId = null, telegramPhotoUrl = null) => {
  const headers = {};
  if (telegramId) {
    headers['X-Telegram-Id'] = String(telegramId);
  }
  if (telegramPhotoUrl) {
    headers['X-Telegram-Photo-Url'] = telegramPhotoUrl;
  }
  return apiClient.post('/users/auth/login', { login, password }, { headers });
};

export const checkUserStatus = (telegramId) => {
  return apiClient.get('/users/me', {
    headers: { 'X-Telegram-Id': telegramId },
  });
};

// --- ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ПОЛЬЗОВАТЕЛЯ ПО USER ID (для браузерной авторизации) ---
export const checkUserStatusById = (userId) => {
  return apiClient.get('/users/me', {
    headers: { 'X-User-Id': userId },
  });
};

/** Вход в админ-панель: email из ADMIN_EMAILS, пароль ADMIN_PANEL_PASSWORD на сервере. */
export function loginAdminPanel(email, password) {
  return apiClient.post('/admin/auth/login', { email, password });
}

/** Проверка Bearer и актуальный профиль панели. */
export function getAdminPanelMe() {
  const token = localStorage.getItem(ADMIN_PANEL_TOKEN_KEY);
  return apiClient.get('/admin/auth/me', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export function clearAdminPanelAuth() {
  localStorage.removeItem(ADMIN_PANEL_TOKEN_KEY);
  localStorage.removeItem(ADMIN_PANEL_USER_KEY);
}

export const registerUser = (telegramId, userData) => {
  const headers = {};
  if (telegramId) {
    headers['X-Telegram-Id'] = telegramId;
  }
  return apiClient.post('/users/auth/register', userData, {
    headers,
  });
};

export const getAllUsers = (telegramId) => {
  const headers = {};
  if (telegramId) {
    // Если передан telegramId, используем его
    headers['X-Telegram-Id'] = telegramId;
  } else {
    // Иначе используем userId из localStorage (для браузерной авторизации)
    const userId = localStorage.getItem('userId');
    if (userId) {
      headers['X-User-Id'] = userId;
    }
  }
  return apiClient.get('/users/', {
    headers,
  });
};

export const transferPoints = (transferData) => {
  return apiClient.post('/points/transfer', transferData);
};

export const requestProfileUpdate = (updateData) =>
  apiClient.post('/users/me/request-update', updateData, getAuthHeaders());

export const updateMe = (updateData) =>
  apiClient.put('/users/me', updateData, getAuthHeaders());

export const getFeed = () => apiClient.get('/transactions/feed');

export const getLeaderboard = ({ period, type }) =>
  apiClient.get(`/leaderboard/?period=${period}&type=${type}`, getAuthHeaders());

export const getMyRank = ({ period, type }) =>
  apiClient.get(`/leaderboard/my-rank?period=${period}&type=${type}`, getAuthHeaders());

export const getLeaderboardStatus = () =>
  apiClient.get('/leaderboard/status', getAuthHeaders());

export const getMarketItems = () => apiClient.get('/market/items');

export const purchaseItem = (userId, itemId) => {
  // Убедись, что user_id здесь это telegram_id
  return apiClient.post('/market/purchase', { user_id: userId, item_id: itemId });
};

export const purchaseLocalItem = (userId, itemId, city, websiteUrl) => {
  return apiClient.post('/market/local-purchase', {
    user_id: userId,
    item_id: itemId,
    city: city,
    website_url: websiteUrl
  });
};

export const getUserTransactions = (userId) => {
  return apiClient.get(`/users/${userId}/transactions`);
};

export const addPointsToAll = (data) =>
  apiClient.post('/admin/add-points', data, getAuthHeaders());

export const createMarketItem = (itemData) =>
  apiClient.post('/admin/market-items', itemData, getAuthHeaders());

export const getBanners = () => apiClient.get('/banners');

// Завершающий слэш обязателен: иначе PUT попадает не в APIRouter, а в SPA catch-all → 405.
export const getAppSettings = () => apiClient.get('/app-settings/');

export const updateAppSettings = (settingsData) =>
  apiClient.put('/app-settings/', settingsData, getAuthHeaders());

export const getAllBanners = () =>
  apiClient.get('/admin/banners', getAuthHeaders());

export const createBanner = (bannerData) =>
  apiClient.post('/admin/banners', bannerData, getAuthHeaders());

export const updateBanner = (bannerId, bannerData) =>
  apiClient.put(`/admin/banners/${bannerId}`, bannerData, getAuthHeaders());

export const deleteBanner = (bannerId) =>
  apiClient.delete(`/admin/banners/${bannerId}`, getAuthHeaders());

export const getAdminMediaStatus = () =>
  apiClient.get('/admin/media/status', getAuthHeaders());

export const uploadAdminMedia = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient.post('/admin/media/upload', formData, {
    headers: {
      ...getAuthHeaders().headers,
    },
  });
};

export const getAllMarketItems = () =>
  apiClient.get('/admin/market-items', getAuthHeaders());

export const updateMarketItem = (itemId, itemData) =>
  apiClient.put(`/admin/market-items/${itemId}`, itemData, getAuthHeaders());

export const archiveMarketItem = (itemId) =>
  apiClient.delete(`/admin/market-items/${itemId}`, getAuthHeaders());

export const getArchivedMarketItems = () =>
  apiClient.get('/admin/market-items/archived', getAuthHeaders());

export const restoreMarketItem = (itemId) =>
  apiClient.post(`/admin/market-items/${itemId}/restore`, {}, getAuthHeaders());

export const assembleTickets = () =>
  apiClient.post('/roulette/assemble', {}, getAuthHeaders());

export const spinRoulette = () =>
  apiClient.post('/roulette/spin', {}, getAuthHeaders());

export const getRouletteHistory = () => apiClient.get('/roulette/history');

export const addTicketsToAll = (data) =>
  apiClient.post('/admin/add-tickets', data, getAuthHeaders());

export const resetDailyTransferLimits = () =>
  apiClient.post('/admin/reset-daily-transfer-limits', {}, getAuthHeaders());

export const deleteUserCard = () =>
  apiClient.delete('/users/me/card', getAuthHeaders());

export const searchUsers = (query) =>
  apiClient.get(`/users/search/?query=${query}`, getAuthHeaders());

export const adminGetAllUsers = () =>
  apiClient.get('/admin/users', getAuthHeaders());

export const adminUpdateUser = (userId, userData) =>
  apiClient.put(`/admin/users/${userId}`, userData, getAuthHeaders());

export const adminDeleteUser = (userId) =>
  apiClient.delete(`/admin/users/${userId}`, getAuthHeaders());

// --- ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ РЕГИСТРАЦИЯМИ ---
export const getPendingUsers = () =>
  apiClient.get('/admin/users/pending', getAuthHeaders());

export const approveUserRegistration = (userId) =>
  apiClient.post(`/admin/users/${userId}/approve`, {}, getAuthHeaders());

export const rejectUserRegistration = (userId) =>
  apiClient.post(`/admin/users/${userId}/reject`, {}, getAuthHeaders());

// --- ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ УЧЕТНЫМИ ДАННЫМИ ---
export const setUserCredentials = (userId, credentials) =>
  apiClient.post(`/admin/users/${userId}/set-credentials`, credentials, getAuthHeaders());

export const bulkSendCredentials = (requestData) =>
  apiClient.post('/admin/users/bulk-send-credentials', requestData, getAuthHeaders());

export const getBroadcastEmailPreview = (onlyBrowserUsers) =>
  apiClient.get('/admin/users/broadcast-email/preview', {
    params: { only_browser_users: onlyBrowserUsers },
    ...getAuthHeaders(),
  });

export const getBroadcastEligibleUsers = (onlyBrowserUsers) =>
  apiClient.get('/admin/users/broadcast/eligible', {
    params: { only_browser_users: onlyBrowserUsers },
    ...getAuthHeaders(),
  });

export const broadcastEmail = (payload) =>
  apiClient.post('/admin/users/broadcast-email', payload, getAuthHeaders());

export const exportBroadcastReport = (payload) =>
  apiClient.post('/admin/users/broadcast/export-report', payload, {
    ...getAuthHeaders(),
    responseType: 'blob',
  });

// --- НОВЫЕ ФУНКЦИИ ДЛЯ СТАТИСТИКИ АДМИН-ПАНЕЛИ ---

// Добавляем startDate и endDate в параметры
export const getGeneralStats = (startDate, endDate) => {
    // Формируем строку с параметрами
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    return apiClient.get(`/admin/statistics/general?${params.toString()}`, getAuthHeaders());
};

export const getHourlyActivityStats = (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

  return apiClient.get(`/admin/statistics/hourly_activity?${params.toString()}`, getAuthHeaders());
};

export const getUserEngagementStats = () => {
  return apiClient.get('/admin/statistics/user_engagement', getAuthHeaders());
};

export const getPopularItemsStats = () => {
  return apiClient.get('/admin/statistics/popular_items', getAuthHeaders());
};

export const getInactiveUsers = () => {
  return apiClient.get('/admin/statistics/inactive_users', getAuthHeaders());
};

export const getTotalBalance = () => {
  return apiClient.get('/admin/statistics/total_balance', getAuthHeaders());
};

export const getLoginActivityStats = (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    return apiClient.get(`/admin/statistics/login_activity?${params.toString()}`, getAuthHeaders());
};

export const getActiveUserRatio = () => {
    return apiClient.get('/admin/statistics/active_user_ratio', getAuthHeaders());
};

// --- НОВЫЙ БЛОК ДЛЯ ЭКСПОРТА ---

export const exportUserEngagement = () => {
    return apiClient.get('/admin/statistics/user_engagement/export', {
        ...getAuthHeaders(), // Добавляем заголовки аутентификации
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
        ...getAuthHeaders(),
        responseType: 'blob', // Указываем, что ждем файл
    });
};

// --- ВЫГРУЗКА ВСЕГО СПИСКА ПОЛЬЗОВАТЕЛЕЙ ---
export const exportAllUsers = () => {
    return apiClient.get('/admin/users/export', {
        ...getAuthHeaders(),
        responseType: 'blob', // Указываем, что ждем файл
    });
};

// --- НОВЫЕ ФУНКЦИИ ДЛЯ РАБОТЫ С СЕССИЯМИ ---

export const startSession = () =>
  apiClient.post('/sessions/start', {}, getAuthHeaders());

export const pingSession = (sessionId) =>
  apiClient.put(`/sessions/ping/${sessionId}`, {}, getAuthHeaders());

export const getAverageSessionDuration = (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    return apiClient.get(`/admin/statistics/average_session_duration?${params.toString()}`, getAuthHeaders());
};

// --- ОБУЧАЮЩИЕ ИСТОРИИ ---
export const completeOnboarding = () =>
  apiClient.post('/users/me/complete-onboarding', {}, getAuthHeaders());

export const deleteMarketItemPermanently = (itemId) =>
  apiClient.delete(`/admin/market-items/${itemId}/permanent`, getAuthHeaders());

// --- API ФУНКЦИИ ДЛЯ STATIX BONUS ---
export const getStatixBonusItem = () => {
    return apiClient.get('/market/statix-bonus');
};

export const purchaseStatixBonus = (telegramId, bonusAmount) =>
  apiClient.post('/market/statix-bonus/purchase', { user_id: telegramId, bonus_amount: bonusAmount }, getAuthHeaders());

// --- Функции для работы с Redis кешем ---

/**
 * Получает значение из кеша Redis
 * @param {string} key - Ключ кеша (feed, market, leaderboard, banners, history)
 */
export const getCache = (key) =>
  apiClient.get(`/cache/${key}`, getAuthHeaders());

/**
 * Устанавливает значение в кеш Redis
 * @param {string} key - Ключ кеша
 * @param {any} value - Значение для сохранения
 * @param {number} ttl - Время жизни в секундах (опционально)
 */
export const setCache = (key, value, ttl = null) =>
  apiClient.post(`/cache/${key}`, { key, value, ttl }, getAuthHeaders());

/**
 * Удаляет значение из кеша Redis
 * @param {string} key - Ключ кеша
 */
export const deleteCache = (key) =>
  apiClient.delete(`/cache/${key}`, getAuthHeaders());

/**
 * Очищает весь кеш пользователя
 */
export const clearAllCache = () =>
  apiClient.delete('/cache/', getAuthHeaders());

// --- АДМИН API ДЛЯ STATIX BONUS ---
export const getStatixBonusSettings = () =>
  apiClient.get('/admin/statix-bonus', getAuthHeaders());

export const updateStatixBonusSettings = (settings) =>
  apiClient.put('/admin/statix-bonus', settings, getAuthHeaders());

export const adminGenerateLeaderboardBanners = () =>
  apiClient.post('/admin/generate-leaderboard-banners', {}, getAuthHeaders());

export const adminGenerateTestLeaderboardBanners = () =>
  apiClient.post('/admin/generate-test-banners', {}, getAuthHeaders());

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

export const cleanupExpiredSharedGiftInvitations = () =>
  apiClient.post('/shared-gifts/cleanup', {}, getAuthHeaders());

// --- ФУНКЦИЯ ДЛЯ ИЗМЕНЕНИЯ ПАРОЛЯ ---
export const changePassword = (currentPassword, newPassword) =>
  apiClient.post('/users/me/change-password', { current_password: currentPassword, new_password: newPassword }, getAuthHeaders());

// --- АДМИН API ДЛЯ УПРАВЛЕНИЯ ПОКУПКАМИ И СОГЛАСОВАНИЯМИ ---
export const getPendingLocalPurchases = () =>
  apiClient.get('/admin/local-purchases/pending', getAuthHeaders());

export const getPendingProfileUpdates = () =>
  apiClient.get('/admin/profile-updates/pending', getAuthHeaders());

export const approveLocalPurchase = (purchaseId) =>
  apiClient.post(`/admin/local-purchases/${purchaseId}/approve`, {}, getAuthHeaders());

export const rejectLocalPurchase = (purchaseId) =>
  apiClient.post(`/admin/local-purchases/${purchaseId}/reject`, {}, getAuthHeaders());

export const approveProfileUpdate = (updateId) =>
  apiClient.post(`/admin/profile-updates/${updateId}/approve`, {}, getAuthHeaders());

export const rejectProfileUpdate = (updateId) =>
  apiClient.post(`/admin/profile-updates/${updateId}/reject`, {}, getAuthHeaders());

// --- АДМИН API ДЛЯ УПРАВЛЕНИЯ ПАРОЛЯМИ ПОЛЬЗОВАТЕЛЕЙ ---
export const adminChangeUserPassword = (userId, newPassword) =>
  apiClient.post(`/admin/users/${userId}/change-password`, { new_password: newPassword }, getAuthHeaders());

export const adminDeleteUserPassword = (userId) =>
  apiClient.delete(`/admin/users/${userId}/password`, getAuthHeaders());

// --- NOTIFICATIONS ---
export const getNotifications = (type = null, page = 1) => {
  const params = { page };
  if (type) params.type = type;
  return apiClient.get('/notifications', { ...getAuthHeaders(), params });
};

export const getUnreadNotificationCount = () =>
  apiClient.get('/notifications/unread-count', getAuthHeaders());

export const markNotificationRead = (notificationId) =>
  apiClient.put(`/notifications/${notificationId}/read`, null, getAuthHeaders());

export const markAllNotificationsRead = () =>
  apiClient.put('/notifications/read-all', null, getAuthHeaders());

// --- CARD UPLOAD ---
export const uploadPkpassFile = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient.post('/users/me/card', formData, getAuthHeaders());
};

// --- ADMIN ALL PURCHASES ---
export const getAllPurchases = (type = null, statusFilter = null, page = 1, perPage = 50) => {
  const params = { page, per_page: perPage };
  if (type) params.type = type;
  if (statusFilter) params.status = statusFilter;
  return apiClient.get('/admin/purchases/all', { ...getAuthHeaders(), params });
};
