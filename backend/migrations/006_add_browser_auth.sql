-- Миграция для добавления поддержки аутентификации через браузер
-- Дата: 2025-01-XX
-- Описание: Добавляет поля для входа через логин/пароль в браузере

-- Добавляем поле login (уникальный логин для входа в браузере)
-- Поле может быть NULL, так как не все пользователи используют вход через браузер
ALTER TABLE users ADD COLUMN IF NOT EXISTS login VARCHAR(255) UNIQUE NULL;

-- Добавляем поле password_hash (хеш пароля для входа в браузере)
-- Поле может быть NULL, так как не все пользователи используют вход через браузер
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL;

-- Добавляем поле browser_auth_enabled (флаг, что пользователь может входить через браузер)
ALTER TABLE users ADD COLUMN IF NOT EXISTS browser_auth_enabled BOOLEAN DEFAULT FALSE NOT NULL;

-- Создаем индекс для быстрого поиска по логину
CREATE INDEX IF NOT EXISTS idx_users_login ON users(login) WHERE login IS NOT NULL;

-- Комментарии к полям
COMMENT ON COLUMN users.login IS 'Уникальный логин для входа в браузере (без Telegram)';
COMMENT ON COLUMN users.password_hash IS 'Хеш пароля для входа в браузере (bcrypt)';
COMMENT ON COLUMN users.browser_auth_enabled IS 'Флаг, что пользователь может входить через браузер с логином/паролем';
