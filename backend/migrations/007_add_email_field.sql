-- Миграция: добавление поля email в таблицу users
-- Дата создания: 2024

ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL;

-- Добавляем индекс для быстрого поиска по email (опционально)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
