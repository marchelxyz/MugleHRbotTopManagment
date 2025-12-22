-- Добавление поля email для веб-аутентификации
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;

-- Создание индекса для быстрого поиска по email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
