-- Миграция для добавления поля email
-- Дата: 2025-01-XX
-- Описание: Добавляет поле email для отправки уведомлений пользователям

-- Добавляем поле email в таблицу users
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR NULL;

-- Создаем индекс для быстрого поиска по email (опционально, если планируется поиск)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- Комментарий для документации
COMMENT ON COLUMN users.email IS 'Email адрес для отправки уведомлений о регистрации и учетных данных';
