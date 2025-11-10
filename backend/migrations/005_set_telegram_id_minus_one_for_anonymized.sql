-- Миграция для установки последовательных отрицательных значений для анонимизированных пользователей
-- Дата: 2025-01-XX
-- Описание: Устанавливает последовательные отрицательные telegram_id для анонимизированных пользователей
--           (-1, -2, -3 и т.д.) для избежания конфликтов уникальности в БД

-- Шаг 1: Устанавливаем последовательные отрицательные значения для всех пользователей с NULL telegram_id
-- Используем ROW_NUMBER() для создания последовательных отрицательных значений
WITH numbered_users AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY id) as row_num
    FROM users
    WHERE telegram_id IS NULL
)
UPDATE users u
SET telegram_id = -1 * n.row_num
FROM numbered_users n
WHERE u.id = n.id;

-- Шаг 2: Удаляем частичный уникальный индекс (если он существует)
DROP INDEX IF EXISTS idx_users_telegram_id_unique;

-- Шаг 3: Создаем обычный уникальный индекс с условием исключения отрицательных значений
-- Это позволяет иметь несколько пользователей с отрицательными telegram_id (анонимизированные)
-- но сохраняет уникальность для реальных telegram_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_id_unique 
ON users(telegram_id) 
WHERE telegram_id >= 0;

-- Комментарий для документации
COMMENT ON COLUMN users.telegram_id IS 'Telegram ID пользователя. Отрицательные значения зарезервированы для анонимизированных/удаленных пользователей (последовательно: -1, -2, -3 и т.д.).';
