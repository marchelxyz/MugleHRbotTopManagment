-- Миграция для создания таблицы отслеживания примененных миграций
-- Эта таблица должна быть создана первой, чтобы отслеживать все последующие миграции

CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Создаем индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_schema_migrations_name ON schema_migrations(migration_name);

COMMENT ON TABLE schema_migrations IS 'Таблица для отслеживания примененных миграций базы данных';
