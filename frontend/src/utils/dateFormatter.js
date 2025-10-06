// frontend/src/utils/dateFormatter.js

// ... (существующие функции formatToMsk и formatDateForDisplay)

/**
 * Новая функция для форматирования заголовков дат в ленте.
 * Превращает дату в "Сегодня", "Вчера" или "5 октября".
 * @param {string} dateInput - Дата в виде строки (из API).
 * @returns {string}
 */
export const formatFeedDate = (dateInput) => {
    if (!dateInput) return '';

    // Создаем объекты Date в часовом поясе Москвы для корректного сравнения дней
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
    // Для остальных дат выводим в формате "5 октября"
    return new Intl.DateTimeFormat('ru-RU', options).format(moscowTime);
};
