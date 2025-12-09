-- Добавляем поле is_shared_gift в таблицу market_items
ALTER TABLE market_items ADD COLUMN is_shared_gift BOOLEAN DEFAULT FALSE NOT NULL;

-- Создаем таблицу для приглашений на совместные подарки
CREATE TABLE shared_gift_invitations (
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

-- Создаем индексы для оптимизации запросов
CREATE INDEX idx_shared_gift_invitations_buyer_id ON shared_gift_invitations(buyer_id);
CREATE INDEX idx_shared_gift_invitations_invited_user_id ON shared_gift_invitations(invited_user_id);
CREATE INDEX idx_shared_gift_invitations_item_id ON shared_gift_invitations(item_id);
CREATE INDEX idx_shared_gift_invitations_status ON shared_gift_invitations(status);
CREATE INDEX idx_shared_gift_invitations_expires_at ON shared_gift_invitations(expires_at);