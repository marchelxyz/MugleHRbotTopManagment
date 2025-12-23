// frontend/src/utils/transliteration.js

/**
 * Транслитерация русского текста в латиницу
 * Преобразует кириллицу в латиницу для генерации логинов
 * @param {string} text - Текст для транслитерации
 * @returns {string} - Транслитерированный текст
 */
export const transliterate = (text) => {
  if (!text) return '';
  
  const translitMap = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    // Заглавные буквы тоже обрабатываем
    'А': 'a', 'Б': 'b', 'В': 'v', 'Г': 'g', 'Д': 'd', 'Е': 'e', 'Ё': 'yo',
    'Ж': 'zh', 'З': 'z', 'И': 'i', 'Й': 'y', 'К': 'k', 'Л': 'l', 'М': 'm',
    'Н': 'n', 'О': 'o', 'П': 'p', 'Р': 'r', 'С': 's', 'Т': 't', 'У': 'u',
    'Ф': 'f', 'Х': 'h', 'Ц': 'ts', 'Ч': 'ch', 'Ш': 'sh', 'Щ': 'sch',
    'Ъ': '', 'Ы': 'y', 'Ь': '', 'Э': 'e', 'Ю': 'yu', 'Я': 'ya'
  };
  
  let result = '';
  const textLower = text.toLowerCase();
  for (let char of textLower) {
    if (char in translitMap) {
      result += translitMap[char];
    } else if (/[a-z0-9]/.test(char)) {
      result += char;
    }
  }
  
  return result;
};

/**
 * Генерирует логин на основе имени и фамилии
 * Транслитерирует русские символы в латиницу
 * @param {string} firstName - Имя пользователя
 * @param {string} lastName - Фамилия пользователя
 * @returns {string} - Сгенерированный логин в формате firstname.lastname
 */
export const generateLoginFromName = (firstName, lastName) => {
  if (!firstName && !lastName) {
    return '';
  }
  
  const firstTranslit = transliterate(firstName || '');
  const lastTranslit = transliterate(lastName || '');
  
  if (firstTranslit && lastTranslit) {
    return `${firstTranslit}.${lastTranslit}`;
  } else if (firstTranslit) {
    return firstTranslit;
  } else if (lastTranslit) {
    return lastTranslit;
  }
  
  return '';
};
