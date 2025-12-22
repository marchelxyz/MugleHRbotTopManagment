-- Миграция: Добавление полей для отложенной отправки учетных данных по email
-- Дата: 2025-12-22

-- Добавляем поля для отслеживания отложенной отправки учетных данных
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS pending_credentials_email BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS credentials_email_sent_at TIMESTAMP WITHOUT TIME ZONE,
ADD COLUMN IF NOT EXISTS credentials_email_attempts INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS pending_password_plain VARCHAR(255);

-- Комментарии к полям
COMMENT ON COLUMN users.pending_credentials_email IS 'Флаг, что учетные данные ожидают отправки по email (после подтверждения email)';
COMMENT ON COLUMN users.credentials_email_sent_at IS 'Время последней попытки отправки учетных данных';
COMMENT ON COLUMN users.credentials_email_attempts IS 'Количество попыток отправки учетных данных';
COMMENT ON COLUMN users.pending_password_plain IS 'Временное хранение пароля в открытом виде до отправки (очищается после отправки)';

-- Создаем индекс для быстрого поиска пользователей с отложенными учетными данными
CREATE INDEX IF NOT EXISTS idx_users_pending_credentials_email 
ON users(pending_credentials_email) 
WHERE pending_credentials_email = TRUE;
