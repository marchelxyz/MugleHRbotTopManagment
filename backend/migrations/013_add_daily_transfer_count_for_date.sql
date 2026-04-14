-- Дата календарного дня (по полю в приложении — Москва), к которому относится daily_transfer_count.
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_transfer_count_for_date DATE;
