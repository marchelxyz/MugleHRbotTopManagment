-- Миграция для изменения колонки telegram_id на nullable
-- Дата: 2025-11-06
-- Описание: Разрешает NULL значения в telegram_id для удаленных пользователей

-- Шаг 1: Удаляем ограничение NOT NULL
ALTER TABLE users ALTER COLUMN telegram_id DROP NOT NULL;

-- Шаг 2: Удаляем старый уникальный constraint (если он существует)
-- Используем DO блок для безопасного удаления constraint
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Находим имя уникального constraint для telegram_id
    -- Проверяем все уникальные constraints на таблице users
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'users'::regclass
    AND contype = 'u'
    AND array_length(conkey, 1) = 1  -- constraint на одну колонку
    AND conkey[1] = (
        SELECT attnum 
        FROM pg_attribute 
        WHERE attrelid = 'users'::regclass 
        AND attname = 'telegram_id'
    );
    
    -- Если нашли constraint, удаляем его
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || quote_ident(constraint_name);
        RAISE NOTICE 'Удален constraint: %', constraint_name;
    END IF;
END $$;

-- Шаг 3: Удаляем старый индекс, если он существует отдельно
DROP INDEX IF EXISTS idx_users_telegram_id;

-- Шаг 4: Создаем новый частичный уникальный индекс
-- Этот индекс позволяет несколько NULL значений, но сохраняет уникальность для не-NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_id_unique 
ON users(telegram_id) 
WHERE telegram_id IS NOT NULL;

-- Комментарий для документации
COMMENT ON COLUMN users.telegram_id IS 'Telegram ID пользователя. Может быть NULL для удаленных/анонимизированных пользователей.';
