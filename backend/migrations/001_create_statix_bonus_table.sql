-- Миграция для создания таблицы statix_bonus_items
-- Дата: 2024-01-XX
-- Описание: Добавляет таблицу для управления товаром "Бонусы Statix"

CREATE TABLE IF NOT EXISTS statix_bonus_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL DEFAULT 'Бонусы Statix',
    description TEXT,
    image_url VARCHAR,
    is_active BOOLEAN NOT NULL DEFAULT true,
    thanks_to_statix_rate INTEGER NOT NULL DEFAULT 10,
    min_bonus_per_step INTEGER NOT NULL DEFAULT 100,
    max_bonus_per_step INTEGER NOT NULL DEFAULT 10000,
    bonus_step INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE statix_bonus_items ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE statix_bonus_items ALTER COLUMN name SET DEFAULT 'Бонусы Statix';
ALTER TABLE statix_bonus_items ALTER COLUMN thanks_to_statix_rate SET DEFAULT 10;
ALTER TABLE statix_bonus_items ALTER COLUMN min_bonus_per_step SET DEFAULT 100;
ALTER TABLE statix_bonus_items ALTER COLUMN max_bonus_per_step SET DEFAULT 10000;
ALTER TABLE statix_bonus_items ALTER COLUMN bonus_step SET DEFAULT 100;
ALTER TABLE statix_bonus_items ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE statix_bonus_items ALTER COLUMN updated_at SET DEFAULT NOW();

-- Вставляем запись по умолчанию (только если таблица пуста)
INSERT INTO statix_bonus_items (name, description, is_active, thanks_to_statix_rate, min_bonus_per_step, max_bonus_per_step, bonus_step, created_at, updated_at)
SELECT 'Бонусы Statix', 'Покупка бонусов для платформы Statix', true, 10, 100, 10000, 100, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM statix_bonus_items LIMIT 1);

-- Создаем индекс для быстрого поиска активных товаров
CREATE INDEX IF NOT EXISTS idx_statix_bonus_items_active ON statix_bonus_items(is_active);

-- Комментарии к полям
COMMENT ON TABLE statix_bonus_items IS 'Таблица для управления товаром "Бонусы Statix"';
COMMENT ON COLUMN statix_bonus_items.thanks_to_statix_rate IS 'Количество спасибок за 100 бонусов Statix';
COMMENT ON COLUMN statix_bonus_items.min_bonus_per_step IS 'Минимальное количество бонусов за один шаг';
COMMENT ON COLUMN statix_bonus_items.max_bonus_per_step IS 'Максимальное количество бонусов за один шаг';
COMMENT ON COLUMN statix_bonus_items.bonus_step IS 'Шаг увеличения количества бонусов';