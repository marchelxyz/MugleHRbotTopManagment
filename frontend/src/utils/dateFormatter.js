// frontend/src/utils/dateFormatter.js

/**
 * Главная функция для форматирования даты и времени в московском часовом поясе.
 * @param {string | Date} dateInput - Дата в виде строки (из API) или объекта Date.
 * @param {object} options - Опции форматирования из Intl.DateTimeFormat.
 * @returns {string} - Отформатированная строка.
 */
export const formatToMsk = (dateInput, options = {}) => {
  if (!dateInput) {
    return ''; // Возвращаем пустую строку, если дата не пришла
  }

  const date = new Date(dateInput);

  // Проверяем, корректная ли дата
  if (isNaN(date.getTime())) {
    // Возвращаем исходную строку, если это не дата
    return dateInput;
  }

  // Настройки по умолчанию: дата и время (ДД.ММ.ГГГГ, ЧЧ:ММ)
  const defaultOptions = {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  };

  // Соединяем опции по умолчанию с теми, что были переданы
  const finalOptions = { ...defaultOptions, ...options };

  // Используем Intl.DateTimeFormat для правильного форматирования
  // 'ru-RU' гарантирует правильный порядок (день.месяц.год)
  return new Intl.DateTimeFormat('ru-RU', finalOptions).format(date);
};

/**
 * Вспомогательная функция для форматирования даты в формат ДД.ММ.ГГГГ.
 * Используется в формах редактирования.
 * @param {string | Date} dateString - Входящая дата.
 * @returns {string} - Дата в формате ДД.ММ.ГГГГ.
 */
export const formatDateForDisplay = (dateString) => {
  if (!dateString) return '';
  // Используем нашу главную функцию, но убираем из нее время
  return formatToMsk(dateString, { hour: undefined, minute: undefined, second: undefined });
};
