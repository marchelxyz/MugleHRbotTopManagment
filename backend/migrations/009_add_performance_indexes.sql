-- Миграция для добавления индексов для оптимизации производительности

-- Индекс для поиска пользователей по telegram_id (часто используется)
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id) WHERE telegram_id >= 0;

-- Индекс для фильтрации транзакций по timestamp (для feed)
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp DESC);

-- Индекс для поиска транзакций по отправителю (для истории)
CREATE INDEX IF NOT EXISTS idx_transactions_sender_id ON transactions(sender_id);

-- Индекс для поиска транзакций по получателю (для истории)
CREATE INDEX IF NOT EXISTS idx_transactions_receiver_id ON transactions(receiver_id);

-- Индекс для фильтрации товаров по архивации (для market)
CREATE INDEX IF NOT EXISTS idx_market_items_archived ON market_items(is_archived) WHERE is_archived = false;

-- Индекс для поиска пользователей по статусу (для админки)
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Индекс для поиска пользователей по логину (для браузерной авторизации)
CREATE INDEX IF NOT EXISTS idx_users_login ON users(login) WHERE login IS NOT NULL;

-- Композитный индекс для лидерборда (период + тип)
-- Примечание: этот индекс будет создан через SQLAlchemy при необходимости
-- CREATE INDEX IF NOT EXISTS idx_transactions_leaderboard ON transactions(timestamp, sender_id, receiver_id);
