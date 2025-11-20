-- Миграция для добавления индексов для оптимизации производительности
-- Выполните эту миграцию для улучшения скорости запросов

-- Индекс для поиска пользователей по telegram_id (уже может существовать через частичный индекс)
-- Проверяем и создаем только если не существует
CREATE INDEX IF NOT EXISTS idx_users_telegram_id_active 
ON users(telegram_id) 
WHERE telegram_id >= 0;

-- Индекс для транзакций по timestamp (для истории и лидерборда)
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp 
ON transactions(timestamp DESC);

-- Индекс для транзакций по sender_id (для истории отправленных)
CREATE INDEX IF NOT EXISTS idx_transactions_sender_id 
ON transactions(sender_id, timestamp DESC);

-- Индекс для транзакций по receiver_id (для истории полученных)
CREATE INDEX IF NOT EXISTS idx_transactions_receiver_id 
ON transactions(receiver_id, timestamp DESC);

-- Составной индекс для лидерборда (receiver_id + timestamp)
CREATE INDEX IF NOT EXISTS idx_transactions_receiver_timestamp 
ON transactions(receiver_id, timestamp DESC);

-- Составной индекс для лидерборда (sender_id + timestamp)
CREATE INDEX IF NOT EXISTS idx_transactions_sender_timestamp 
ON transactions(sender_id, timestamp DESC);

-- Индекс для пользователей по статусу (для фильтрации)
CREATE INDEX IF NOT EXISTS idx_users_status 
ON users(status);

-- Индекс для покупок по timestamp (для статистики)
CREATE INDEX IF NOT EXISTS idx_purchases_timestamp 
ON purchases(timestamp DESC);

-- Индекс для покупок по user_id (для истории покупок пользователя)
CREATE INDEX IF NOT EXISTS idx_purchases_user_id 
ON purchases(user_id, timestamp DESC);

-- Индекс для покупок по item_id (для статистики товаров)
CREATE INDEX IF NOT EXISTS idx_purchases_item_id 
ON purchases(item_id);

-- Индекс для товаров магазина по is_archived (для фильтрации активных товаров)
CREATE INDEX IF NOT EXISTS idx_market_items_archived 
ON market_items(is_archived) 
WHERE is_archived = false;

-- Индекс для баннеров по позиции и активности (для быстрого получения активных баннеров)
CREATE INDEX IF NOT EXISTS idx_banners_position_active 
ON banners(position, is_active) 
WHERE is_active = true;

-- Индекс для сессий пользователей по user_id и last_seen (для очистки старых сессий)
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_last_seen 
ON user_sessions(user_id, last_seen DESC);

-- Индекс для кодов товаров по is_issued (для поиска доступных кодов)
CREATE INDEX IF NOT EXISTS idx_item_codes_issued 
ON item_codes(is_issued, market_item_id) 
WHERE is_issued = false;

-- Индекс для рулетки по user_id и timestamp (для истории выигрышей)
CREATE INDEX IF NOT EXISTS idx_roulette_wins_user_timestamp 
ON roulette_wins(user_id, timestamp DESC);

-- Индекс для совместных подарков по статусу и expires_at (для очистки истекших)
CREATE INDEX IF NOT EXISTS idx_shared_gifts_status_expires 
ON shared_gift_invitations(status, expires_at) 
WHERE status = 'pending';

-- Комментарии для документации
COMMENT ON INDEX idx_users_telegram_id_active IS 'Индекс для быстрого поиска активных пользователей по telegram_id';
COMMENT ON INDEX idx_transactions_timestamp IS 'Индекс для сортировки транзакций по времени';
COMMENT ON INDEX idx_transactions_receiver_timestamp IS 'Индекс для лидерборда получателей';
COMMENT ON INDEX idx_transactions_sender_timestamp IS 'Индекс для лидерборда отправителей';
