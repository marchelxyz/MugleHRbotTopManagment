// frontend/src/utils/dateFormatter.js

/**
 * Главная функция для форматирования даты и времени в московском часовом поясе.
 * @param {string | Date} dateInput - Дата в виде строки (из API) или объекта Date.
 * @param {object} options - Опции форматирования.
 * @returns {string} - Отформатированная строка.
 */
export const formatToMsk = (dateInput, options = {}) => {
  if (!dateInput) {
    return ''; // Возвращаем пустую строку, если дата не пришла
  }

  const date = new Date(dateInput);

  // Проверяем, корректная ли дата
  if (isNaN(date.getTime())) {
    return 'Некорректная дата';
  }

  // Настройки по умолчанию: дата и время
  const defaultOptions = {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  };

  // Сливаем дефолтные опции с теми, что передали в функцию
  const finalOptions = { ...defaultOptions, ...options };

  return new Intl.DateTimeFormat('ru-RU', finalOptions).format(date);
};

// --- Твоя старая функция, которую мы обновим для обратной совместимости ---
// Теперь она тоже будет использовать московское время.
export const formatDateForDisplay = (dateString) => {
  if (!dateString) return '';
  // Используем нашу новую функцию только для форматирования даты
  return formatToMsk(dateString, { hour: undefined, minute: undefined });
};
