// frontend/src/utils/nameFormatter.js

/**
 * Форматирует имя пользователя в формате "Имя Ф."
 * где Ф. - первая буква фамилии с точкой
 * @param {string} firstName - Имя пользователя
 * @param {string} lastName - Фамилия пользователя (опционально)
 * @returns {string} - Отформатированное имя
 */
export const formatUserName = (firstName, lastName) => {
  if (!firstName) return '';
  
  if (lastName && lastName.trim()) {
    const firstLetter = lastName.trim()[0].toUpperCase();
    return `${firstName} ${firstLetter}.`;
  }
  
  return firstName;
};
