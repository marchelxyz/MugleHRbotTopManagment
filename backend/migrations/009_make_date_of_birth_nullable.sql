-- Миграция для изменения колонки date_of_birth на nullable
-- Дата: 2025-12-29
-- Описание: Разрешает NULL значения в date_of_birth для пользователей без указанной даты рождения

-- Удаляем ограничение NOT NULL
ALTER TABLE users ALTER COLUMN date_of_birth DROP NOT NULL;

-- Комментарий для документации
COMMENT ON COLUMN users.date_of_birth IS 'Дата рождения пользователя. Может быть NULL, если дата не указана.';
