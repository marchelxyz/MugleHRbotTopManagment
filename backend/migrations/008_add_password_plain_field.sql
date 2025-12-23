-- Миграция: добавление поля password_plain в таблицу users для хранения пароля в открытом виде (только для админов)
-- Дата создания: 2024

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain VARCHAR(255) NULL;
