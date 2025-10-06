// frontend/src/utils/dateFormatter.js

/**
 * Главная функция для форматирования даты и времени в московском часовом поясе.
 * @param {string | Date} dateInput - Дата в виде строки (из API) или объекта Date.
 * @param {object} options - Опции форматирования из Intl.DateTimeFormat.
 * @returns {string} - Отформатированная строка.
 */
export const formatToMsk = (dateInput, options = {}) => {
  if (!dateInput) {
    return '';
  }

  // Добавляем 'Z' к строке, чтобы браузер гарантированно распознал её как UTC
  const date = new Date(typeof dateInput === 'string' && !dateInput.endsWith('Z') ? dateInput + 'Z' : dateInput);

  if (isNaN(date.getTime())) {
    return dateInput;
  }

  const defaultOptions = {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  };

  const finalOptions = { ...defaultOptions, ...options };
  return new Intl.DateTimeFormat('ru-RU', finalOptions).format(date);
};

/**
 * Функция для форматирования заголовков дат в ленте ("Сегодня", "Вчера").
 * @param {string} dateInput - Дата в виде строки (из API).
 * @returns {string}
 */
export const formatFeedDate = (dateInput) => {
    if (!dateInput) return '';

    const moscowTime = new Date(new Date(dateInput + 'Z').toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const options = { month: 'long', day: 'numeric' };

    if (moscowTime.toDateString() === today.toDateString()) {
        return 'Сегодня';
    }
    if (moscowTime.toDateString() === yesterday.toDateString()) {
        return 'Вчера';
    }
    return new Intl.DateTimeFormat('ru-RU', options).format(moscowTime);
};


/**
 * Вспомогательная функция для форматирования даты в формат ДД.ММ.ГГГГ.
 * @param {string | Date} dateString - Входящая дата.
 * @returns {string} - Дата в формате ДД.ММ.ГГГГ.
 */
export const formatDateForDisplay = (dateString) => {
  if (!dateString) return '';
  return formatToMsk(dateString, { hour: undefined, minute: undefined, second: undefined });
};
