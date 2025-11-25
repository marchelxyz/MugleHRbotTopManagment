// frontend/src/utils/nameFormatter.js

/**
 * Форматирует имя пользователя в формате "Имя Ф."
 * где Ф. - первая буква фамилии с точкой
 * Если у пользователя нет username (ника в телеграм), вместо фамилии показывается имя
 * @param {string} firstName - Имя пользователя
 * @param {string} lastName - Фамилия пользователя (опционально)
 * @param {string} username - Ник в телеграм (опционально)
 * @returns {string} - Отформатированное имя
 */
export const formatUserName = (firstName, lastName, username) => {
  if (!firstName) return '';
  
  // Если нет username, вместо фамилии показываем имя
  if (!username || !username.trim()) {
    return firstName;
  }
  
  // Если есть username, показываем как обычно: "Имя Ф."
  if (lastName && lastName.trim()) {
    const firstLetter = lastName.trim()[0].toUpperCase();
    return `${firstName} ${firstLetter}.`;
  }
  
  return firstName;
};
