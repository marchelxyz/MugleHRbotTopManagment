-- URL изображений интерфейса (лето/зима), JSON { "summer": {...}, "winter": {...} }

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS theme_assets JSONB;
