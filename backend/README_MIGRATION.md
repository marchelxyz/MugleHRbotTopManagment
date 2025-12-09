# Применение миграции 006_add_browser_auth.sql

## Что было сделано:
1. ✅ Код в `routers/auth.py` раскомментирован
2. ✅ Поле `login` в `models.py` уже было раскомментировано

## Что нужно сделать:

### Вариант 1: Автоматическое применение при перезапуске приложения
Приложение автоматически применяет миграции при запуске через `app.py`. 
Просто перезапустите приложение, и миграция будет применена автоматически.

### Вариант 2: Ручное применение через скрипт
Запустите один из скриптов с переменными окружения:

```bash
# Убедитесь, что переменные окружения установлены (DATABASE_URL и др.)
cd /workspace/backend
python3 apply_browser_auth_migration.py
```

или

```bash
python3 run_migrations.py
```

### Вариант 3: Прямое применение через SQL
Если у вас есть доступ к базе данных через psql или другой клиент:

```bash
psql $DATABASE_URL -f migrations/006_add_browser_auth.sql
```

## Проверка применения миграции
После применения миграции проверьте, что поля добавлены:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('login', 'password_hash', 'browser_auth_enabled');
```

Должны быть видны три поля:
- `login` (character varying, nullable)
- `password_hash` (character varying, nullable)  
- `browser_auth_enabled` (boolean, not null)
