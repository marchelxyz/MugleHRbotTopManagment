-- 003_add_database_indexes.sql
-- Добавление индексов для оптимизации производительности

-- Индексы для таблицы users
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_last_login_date ON users(last_login_date);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
CREATE INDEX IF NOT EXISTS idx_users_balance ON users(balance);

-- Индексы для таблицы transactions
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_transactions_sender_id ON transactions(sender_id);
CREATE INDEX IF NOT EXISTS idx_transactions_receiver_id ON transactions(receiver_id);
CREATE INDEX IF NOT EXISTS idx_transactions_amount ON transactions(amount);
CREATE INDEX IF NOT EXISTS idx_transactions_sender_receiver ON transactions(sender_id, receiver_id);

-- Индексы для таблицы purchases
CREATE INDEX IF NOT EXISTS idx_purchases_timestamp ON purchases(timestamp);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_item_id ON purchases(item_id);

-- Индексы для таблицы market_items
CREATE INDEX IF NOT EXISTS idx_market_items_is_archived ON market_items(is_archived);
CREATE INDEX IF NOT EXISTS idx_market_items_price ON market_items(price);
CREATE INDEX IF NOT EXISTS idx_market_items_price_rub ON market_items(price_rub);

-- Индексы для таблицы banners
CREATE INDEX IF NOT EXISTS idx_banners_is_active ON banners(is_active);
CREATE INDEX IF NOT EXISTS idx_banners_created_at ON banners(created_at);

-- Индексы для таблицы roulette_wins
CREATE INDEX IF NOT EXISTS idx_roulette_wins_timestamp ON roulette_wins(timestamp);
CREATE INDEX IF NOT EXISTS idx_roulette_wins_user_id ON roulette_wins(user_id);

-- Индексы для таблицы user_sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_start ON user_sessions(session_start);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_seen ON user_sessions(last_seen);

-- Индексы для таблицы item_codes
CREATE INDEX IF NOT EXISTS idx_item_codes_code_value ON item_codes(code_value);
CREATE INDEX IF NOT EXISTS idx_item_codes_market_item_id ON item_codes(market_item_id);
CREATE INDEX IF NOT EXISTS idx_item_codes_is_issued ON item_codes(is_issued);

-- Индексы для таблицы statix_bonus_items
CREATE INDEX IF NOT EXISTS idx_statix_bonus_items_is_active ON statix_bonus_items(is_active);

-- Индексы для таблицы shared_gift_invitations
CREATE INDEX IF NOT EXISTS idx_shared_gift_invitations_buyer_id ON shared_gift_invitations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_shared_gift_invitations_invited_user_id ON shared_gift_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_gift_invitations_item_id ON shared_gift_invitations(item_id);
CREATE INDEX IF NOT EXISTS idx_shared_gift_invitations_status ON shared_gift_invitations(status);
CREATE INDEX IF NOT EXISTS idx_shared_gift_invitations_expires_at ON shared_gift_invitations(expires_at);

-- Индексы для таблицы pending_updates
CREATE INDEX IF NOT EXISTS idx_pending_updates_user_id ON pending_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_updates_created_at ON pending_updates(created_at);

-- Составные индексы для часто используемых запросов
CREATE INDEX IF NOT EXISTS idx_transactions_receiver_timestamp ON transactions(receiver_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_transactions_sender_timestamp ON transactions(sender_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_users_status_last_login ON users(status, last_login_date);
CREATE INDEX IF NOT EXISTS idx_purchases_user_timestamp ON purchases(user_id, timestamp);
