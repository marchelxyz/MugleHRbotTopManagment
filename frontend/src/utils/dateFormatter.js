// frontend/src/utils/dateFormatter.js

/**
 * Форматирует дату из строки YYYY-MM-DD в DD.MM.YYYY
 * @param {string | null | undefined} dateString - Дата в формате 'YYYY-MM-DD'
 * @returns {string} - Дата в формате 'DD.MM.YYYY' или пустая строка
 */
export const formatDateForDisplay = (dateString) => {
  if (!dateString) return '';
  try {
    const [year, month, day] = dateString.split('-');
    // Убедимся, что все части даты присутствуют
    if (year && month && day) {
      return `${day}.${month}.${year}`;
    }
    return ''; // Возвращаем пустую строку, если формат некорректный
  } catch (error) {
    console.error('Ошибка форматирования даты:', dateString, error);
    return ''; // В случае любой ошибки возвращаем пустую строку
  }
};
