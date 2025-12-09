-- Добавляем поле is_shared_gift в таблицу market_items (идемпотентно)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='market_items' AND column_name='is_shared_gift') THEN
        ALTER TABLE market_items ADD COLUMN is_shared_gift BOOLEAN DEFAULT FALSE NOT NULL;
    END IF;
END $$;

-- Создаем таблицу для приглашений на совместные подарки (идемпотентно)
CREATE TABLE IF NOT EXISTS shared_gift_invitations (
    id SERIAL PRIMARY KEY,
    buyer_id INTEGER NOT NULL REFERENCES users(id),
    invited_user_id INTEGER NOT NULL REFERENCES users(id),
    item_id INTEGER NOT NULL REFERENCES market_items(id),
    status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP NULL,
    rejected_at TIMESTAMP NULL
);

-- Создаем индексы для оптимизации запросов (идемпотентно)
CREATE INDEX IF NOT EXISTS idx_shared_gift_invitations_buyer_id ON shared_gift_invitations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_shared_gift_invitations_invited_user_id ON shared_gift_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_gift_invitations_item_id ON shared_gift_invitations(item_id);
CREATE INDEX IF NOT EXISTS idx_shared_gift_invitations_status ON shared_gift_invitations(status);
CREATE INDEX IF NOT EXISTS idx_shared_gift_invitations_expires_at ON shared_gift_invitations(expires_at);