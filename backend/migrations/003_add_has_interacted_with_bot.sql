-- Добавляем поле has_interacted_with_bot в таблицу users
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_interacted_with_bot BOOLEAN DEFAULT FALSE NOT NULL;
