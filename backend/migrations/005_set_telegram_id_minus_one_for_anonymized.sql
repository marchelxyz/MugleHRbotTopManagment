-- Миграция для установки -1 вместо NULL для анонимизированных пользователей
-- Дата: 2025-01-XX
-- Описание: Устанавливает telegram_id = -1 для всех пользователей с NULL telegram_id
--           Это более надежное решение, чем использование NULL значений

-- Шаг 1: Устанавливаем -1 для всех пользователей с NULL telegram_id
UPDATE users 
SET telegram_id = -1 
WHERE telegram_id IS NULL;

-- Шаг 2: Удаляем частичный уникальный индекс (если он существует)
DROP INDEX IF EXISTS idx_users_telegram_id_unique;

-- Шаг 3: Создаем обычный уникальный индекс с условием исключения -1
-- Это позволяет иметь несколько пользователей с telegram_id = -1 (анонимизированные)
-- но сохраняет уникальность для реальных telegram_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_id_unique 
ON users(telegram_id) 
WHERE telegram_id != -1;

-- Комментарий для документации
COMMENT ON COLUMN users.telegram_id IS 'Telegram ID пользователя. Значение -1 зарезервировано для анонимизированных/удаленных пользователей.';
