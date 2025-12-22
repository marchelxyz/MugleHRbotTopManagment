-- Добавление поля vk_id для отправки сообщений через ВКонтакте
ALTER TABLE users ADD COLUMN IF NOT EXISTS vk_id BIGINT;

-- Создание индекса для быстрого поиска по vk_id
CREATE INDEX IF NOT EXISTS idx_users_vk_id ON users(vk_id);
