-- Миграция для исправления проблемы с дубликатами telegram_id = -1
-- Дата: 2025-11-07
-- Описание: Удаляет старый уникальный индекс ix_users_telegram_id и оставляет только частичный индекс

-- Шаг 1: Удаляем старый уникальный индекс, если он существует
DROP INDEX IF EXISTS ix_users_telegram_id;

-- Шаг 2: Убеждаемся, что частичный индекс существует (из миграции 005)
-- Этот индекс позволяет иметь несколько пользователей с telegram_id = -1
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_id_unique 
ON users(telegram_id) 
WHERE telegram_id != -1;

-- Комментарий для документации
COMMENT ON COLUMN users.telegram_id IS 'Telegram ID пользователя. Значение -1 зарезервировано для анонимизированных/удаленных пользователей.';
