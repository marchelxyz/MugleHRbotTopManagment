-- Миграция для добавления поддержки аутентификации через браузер
-- Дата: 2025-01-XX
-- Описание: Добавляет поля для входа через логин/пароль в браузере

-- Добавляем поле login (уникальный логин для входа в браузере)
-- Поле может быть NULL, так как не все пользователи используют вход через браузер
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='login') THEN
        ALTER TABLE users ADD COLUMN login VARCHAR(255) NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login_unique ON users(login) WHERE login IS NOT NULL;
    END IF;
END $$;

-- Добавляем поле password_hash (хеш пароля для входа в браузере)
-- Поле может быть NULL, так как не все пользователи используют вход через браузер
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_hash') THEN
        ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NULL;
    END IF;
END $$;

-- Добавляем поле browser_auth_enabled (флаг, что пользователь может входить через браузер)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='browser_auth_enabled') THEN
        ALTER TABLE users ADD COLUMN browser_auth_enabled BOOLEAN DEFAULT FALSE NOT NULL;
    END IF;
END $$;

-- Создаем индекс для быстрого поиска по логину (если еще не создан)
CREATE INDEX IF NOT EXISTS idx_users_login ON users(login) WHERE login IS NOT NULL;

-- Комментарии к полям
COMMENT ON COLUMN users.login IS 'Уникальный логин для входа в браузере (без Telegram)';
COMMENT ON COLUMN users.password_hash IS 'Хеш пароля для входа в браузере (bcrypt)';
COMMENT ON COLUMN users.browser_auth_enabled IS 'Флаг, что пользователь может входить через браузер с логином/паролем';
