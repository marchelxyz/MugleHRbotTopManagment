-- Миграция для поддержки локальных подарков
-- Дата: 2025-01-XX
-- Описание: Добавляет поддержку локальных подарков с резервированием спасибок

-- Шаг 1: Добавляем поле reserved_balance в таблицу users
ALTER TABLE users ADD COLUMN IF NOT EXISTS reserved_balance INTEGER DEFAULT 0 NOT NULL;

-- Шаг 2: Добавляем поле is_local_purchase в таблицу market_items
ALTER TABLE market_items ADD COLUMN IF NOT EXISTS is_local_purchase BOOLEAN DEFAULT FALSE NOT NULL;

-- Шаг 3: Создаем таблицу local_purchases
CREATE TABLE IF NOT EXISTS local_purchases (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    item_id INTEGER NOT NULL REFERENCES market_items(id),
    purchase_id INTEGER NOT NULL REFERENCES purchases(id),
    city VARCHAR NOT NULL,
    website_url VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'pending' NOT NULL,
    reserved_amount INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Шаг 4: Создаем индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_local_purchases_user_id ON local_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_local_purchases_status ON local_purchases(status);
CREATE INDEX IF NOT EXISTS idx_local_purchases_purchase_id ON local_purchases(purchase_id);

-- Комментарии для документации
COMMENT ON COLUMN users.reserved_balance IS 'Зарезервированные спасибки для локальных подарков';
COMMENT ON COLUMN market_items.is_local_purchase IS 'Флаг товара для локального подарка';
COMMENT ON TABLE local_purchases IS 'Таблица локальных подарков с информацией о городе и ссылке на сайт';
COMMENT ON COLUMN local_purchases.status IS 'Статус подарка: pending, approved, rejected';
