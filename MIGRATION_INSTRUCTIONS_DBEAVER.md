# Инструкция по миграции для DBeaver

## Описание изменений
Убрано использование значения `-1` для анонимизированных пользователей. Теперь для анонимизированных пользователей используется `NULL` в поле `telegram_id`.

## Шаги для выполнения миграции в DBeaver

### Шаг 1: Проверка текущего состояния
Сначала проверьте, есть ли в базе пользователи с `telegram_id = -1`:

```sql
SELECT COUNT(*) FROM users WHERE telegram_id = -1;
```

Если результат больше 0, переходите к Шагу 2. Если 0, переходите к Шагу 3.

### Шаг 2: Замена -1 на NULL
Если есть пользователи с `telegram_id = -1`, замените их на `NULL`:

```sql
UPDATE users 
SET telegram_id = NULL 
WHERE telegram_id = -1;
```

Проверьте результат:
```sql
SELECT COUNT(*) FROM users WHERE telegram_id = -1;
```
Должно вернуться 0.

### Шаг 3: Удаление старого индекса (если существует)
Если был создан индекс с условием `WHERE telegram_id != -1`, удалите его:

```sql
DROP INDEX IF EXISTS idx_users_telegram_id_unique;
```

### Шаг 4: Применение миграции 004
Выполните SQL из файла `backend/migrations/004_make_telegram_id_nullable.sql`:

```sql
-- Шаг 1: Удаляем ограничение NOT NULL
ALTER TABLE users ALTER COLUMN telegram_id DROP NOT NULL;

-- Шаг 2: Удаляем старый уникальный constraint (если он существует)
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Находим имя уникального constraint для telegram_id
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'users'::regclass
    AND contype = 'u'
    AND array_length(conkey, 1) = 1
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
```

### Шаг 5: Проверка результата
Проверьте, что миграция выполнена успешно:

```sql
-- Проверка структуры колонки (должна быть nullable)
SELECT 
    column_name, 
    is_nullable, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'telegram_id';

-- Проверка индекса
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'users' 
AND indexname = 'idx_users_telegram_id_unique';

-- Проверка, что нет пользователей с -1
SELECT COUNT(*) FROM users WHERE telegram_id = -1;
-- Должно вернуться 0

-- Проверка, что есть пользователи с NULL (если были анонимизированные)
SELECT COUNT(*) FROM users WHERE telegram_id IS NULL;
```

## Важные замечания

1. **Резервное копирование**: Перед выполнением миграции рекомендуется создать резервную копию базы данных.

2. **Время выполнения**: Миграция должна выполняться быстро, но если в таблице `users` много записей, операция UPDATE может занять некоторое время.

3. **Проверка после миграции**: После выполнения миграции убедитесь, что приложение работает корректно и нет ошибок в логах.

4. **Откат изменений**: Если потребуется откатить изменения, выполните обратные операции:
   ```sql
   -- ВНИМАНИЕ: Это только для отката, не выполняйте без необходимости!
   UPDATE users SET telegram_id = -1 WHERE telegram_id IS NULL;
   ALTER TABLE users ALTER COLUMN telegram_id SET NOT NULL;
   ```

## Порядок выполнения команд в DBeaver

1. Откройте DBeaver и подключитесь к вашей базе данных PostgreSQL
2. Откройте SQL Editor (SQL редактор)
3. Выполняйте команды последовательно, начиная с Шага 1
4. После каждого шага проверяйте результат выполнения
5. Если возникнут ошибки, проверьте логи и убедитесь, что предыдущие шаги выполнены корректно
