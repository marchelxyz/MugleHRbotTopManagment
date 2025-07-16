// frontend/src/api.js
import axios from 'axios';

// Создаем экземпляр axios с базовыми настройками
const apiClient = axios.create({
  // URL нашего бэкенда из переменных окружения, которые мы настроили в Vercel
  baseURL: import.meta.env.VITE_API_URL,
});

/**
 * Функция для проверки статуса регистрации пользователя.
 * @param {string} telegramId - ID пользователя из Telegram.
 * @returns {Promise<object>} - Данные пользователя.
 */
export const checkUserStatus = (telegramId) => {
  return apiClient.get('/users/me', {
    headers: {
      // Отправляем ID в заголовках, как ожидает наш бэкенд
      'X-Telegram-Id': telegramId,
    },
  });
};

/**
 * Функция для регистрации нового пользователя.
 * @param {string} telegramId - ID пользователя из Telegram.
 * @param {object} userData - Данные для регистрации { firstName, username, position }.
 * @returns {Promise<object>} - Данные созданного пользователя.
 */
export const registerUser = (telegramId, userData) => {
  return apiClient.post('/auth/register', userData, {
    headers: {
      'X-Telegram-Id': telegramId,
    },
  });
};
