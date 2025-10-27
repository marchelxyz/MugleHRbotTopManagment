// utils/errorHandler.js

export const handleApiError = (error, context = '') => {
  console.error(`API Error in ${context}:`, error);
  
  if (error.response) {
    // Сервер ответил с кодом ошибки
    const status = error.response.status;
    const message = error.response.data?.message || error.response.data?.detail || 'Ошибка сервера';
    
    switch (status) {
      case 400:
        return { message: 'Неверный запрос: ' + message, type: 'warning' };
      case 401:
        return { message: 'Не авторизован', type: 'error' };
      case 403:
        return { message: 'Доступ запрещен', type: 'error' };
      case 404:
        return { message: 'Ресурс не найден', type: 'warning' };
      case 422:
        return { message: 'Ошибка валидации: ' + message, type: 'warning' };
      case 500:
        return { message: 'Внутренняя ошибка сервера', type: 'error' };
      default:
        return { message: `Ошибка ${status}: ${message}`, type: 'error' };
    }
  } else if (error.request) {
    // Запрос был отправлен, но ответа не получено
    return { message: 'Нет соединения с сервером', type: 'error' };
  } else {
    // Что-то пошло не так при настройке запроса
    return { message: 'Ошибка настройки запроса: ' + error.message, type: 'error' };
  }
};

export const handleAsyncError = async (asyncFn, context = '') => {
  try {
    return await asyncFn();
  } catch (error) {
    const errorInfo = handleApiError(error, context);
    throw new Error(errorInfo.message);
  }
};

export const withErrorHandling = (fn, context = '') => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const errorInfo = handleApiError(error, context);
      throw new Error(errorInfo.message);
    }
  };
};
