// frontend/src/utils/auth.js

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

/**
 * Сохраняет JWT токен в localStorage
 */
export const saveToken = (token) => {
  localStorage.setItem(TOKEN_KEY, token);
};

/**
 * Получает JWT токен из localStorage
 */
export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Удаляет JWT токен из localStorage
 */
export const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

/**
 * Сохраняет данные пользователя в localStorage
 */
export const saveUser = (user) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

/**
 * Получает данные пользователя из localStorage
 */
export const getUser = () => {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

/**
 * Проверяет, есть ли сохраненный токен
 */
export const isAuthenticated = () => {
  return !!getToken();
};

/**
 * Очищает все данные аутентификации
 */
export const clearAuth = () => {
  removeToken();
};

/**
 * Определяет, запущено ли приложение в Telegram или в браузере
 */
export const isTelegramMode = () => {
  return typeof window !== 'undefined' && 
         window.Telegram && 
         window.Telegram.WebApp && 
         window.Telegram.WebApp.initDataUnsafe?.user;
};
