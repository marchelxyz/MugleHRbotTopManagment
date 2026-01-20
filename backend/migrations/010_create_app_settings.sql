-- Миграция: таблица настроек приложения (оформление)
-- Дата: 2026-01-20

CREATE TABLE IF NOT EXISTS app_settings (
    id SERIAL PRIMARY KEY,
    season_theme VARCHAR(20) NOT NULL DEFAULT 'summer',
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (season_theme)
SELECT 'summer'
WHERE NOT EXISTS (SELECT 1 FROM app_settings);
