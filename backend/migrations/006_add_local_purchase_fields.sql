-- Миграция для добавления поддержки локальных покупок
-- Добавляем поле is_local_purchase в таблицу market_items
ALTER TABLE market_items ADD COLUMN IF NOT EXISTS is_local_purchase BOOLEAN DEFAULT FALSE NOT NULL;

-- Добавляем поле reserved_balance в таблицу users
ALTER TABLE users ADD COLUMN IF NOT EXISTS reserved_balance INTEGER DEFAULT 0 NOT NULL;

-- Создаем таблицу local_purchases
CREATE TABLE IF NOT EXISTS local_purchases (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    item_id INTEGER NOT NULL REFERENCES market_items(id),
    purchase_id INTEGER REFERENCES purchases(id),
    city VARCHAR NOT NULL,
    purchase_url VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP
);

-- Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_local_purchases_user_id ON local_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_local_purchases_item_id ON local_purchases(item_id);
CREATE INDEX IF NOT EXISTS idx_local_purchases_status ON local_purchases(status);
CREATE INDEX IF NOT EXISTS idx_local_purchases_created_at ON local_purchases(created_at);
