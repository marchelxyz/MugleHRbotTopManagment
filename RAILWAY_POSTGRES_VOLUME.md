# Подключение Volume к PostgreSQL на Railway

## Можно ли подключить Volume к БД PostgreSQL на Railway?

**Да, Railway поддерживает подключение volumes к PostgreSQL базам данных.** Это позволяет:
- Сохранять данные между перезапусками сервиса
- Обеспечивать персистентность данных
- Защищать данные от потери при обновлениях

## Как подключить Volume к PostgreSQL на Railway

### Способ 1: Через Railway Dashboard (Веб-интерфейс)

1. **Войдите в Railway Dashboard**
   - Откройте https://railway.app
   - Войдите в свой аккаунт

2. **Выберите ваш проект**
   - Найдите проект с PostgreSQL базой данных

3. **Откройте настройки PostgreSQL сервиса**
   - Кликните на сервис PostgreSQL в вашем проекте
   - Перейдите в раздел **"Settings"** или **"Настройки"**

4. **Добавьте Volume**
   - Найдите раздел **"Volumes"** или **"Тома"**
   - Нажмите кнопку **"Add Volume"** или **"Добавить том"**
   - Укажите путь монтирования (обычно `/var/lib/postgresql/data` для PostgreSQL)
   - Выберите размер volume (минимум 1GB, рекомендуется 5-10GB для начала)
   - Нажмите **"Create"** или **"Создать"**

5. **Перезапустите сервис**
   - После создания volume перезапустите PostgreSQL сервис
   - Данные будут сохранены в volume

### Способ 2: Через Railway CLI

1. **Установите Railway CLI** (если еще не установлен)
   ```bash
   npm i -g @railway/cli
   ```

2. **Войдите в Railway**
   ```bash
   railway login
   ```

3. **Выберите проект**
   ```bash
   railway link
   ```

4. **Создайте volume для PostgreSQL**
   ```bash
   railway volume create --service <postgres-service-name> --mount-path /var/lib/postgresql/data --size 5GB
   ```
   
   Где:
   - `<postgres-service-name>` - имя вашего PostgreSQL сервиса
   - `/var/lib/postgresql/data` - стандартный путь для данных PostgreSQL
   - `5GB` - размер volume (можно изменить)

5. **Перезапустите сервис**
   ```bash
   railway restart --service <postgres-service-name>
   ```

### Способ 3: Через railway.json или railway.toml (если поддерживается)

Создайте файл `railway.json` в корне проекта:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "uvicorn app:app --host 0.0.0.0 --port $PORT",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Примечание:** Railway может не поддерживать полную конфигурацию volumes через JSON/TOML файлы. Рекомендуется использовать Dashboard или CLI.

## Важные моменты

### 1. Путь монтирования
- **Стандартный путь для PostgreSQL:** `/var/lib/postgresql/data`
- Этот путь содержит все данные базы данных, включая таблицы, индексы и конфигурацию

### 2. Размер Volume
- **Минимальный размер:** 1GB
- **Рекомендуемый размер:** 
  - Для небольших проектов: 5-10GB
  - Для средних проектов: 20-50GB
  - Для больших проектов: 100GB+
- Размер можно увеличить позже, но уменьшить нельзя

### 3. Миграция существующих данных

Если у вас уже есть данные в PostgreSQL без volume:

**Вариант A: Создать резервную копию и восстановить**
```bash
# Создать дамп базы данных
railway run --service <postgres-service-name> pg_dump -U postgres <database-name> > backup.sql

# После создания volume восстановить данные
railway run --service <postgres-service-name> psql -U postgres <database-name> < backup.sql
```

**Вариант B: Использовать Railway встроенные инструменты**
- Railway автоматически перенесет данные при создании volume (в большинстве случаев)
- Но рекомендуется создать резервную копию на всякий случай

### 4. Проверка подключения Volume

После создания volume проверьте, что он подключен:

```bash
# Через Railway CLI
railway volume list --service <postgres-service-name>

# Или через Dashboard
# В разделе Settings -> Volumes должен отображаться созданный volume
```

### 5. Стоимость

- Railway взимает плату за использование volumes
- Стоимость зависит от размера и региона
- Проверьте актуальные тарифы на https://railway.app/pricing

## Пример полной настройки

### Шаг 1: Создание volume через Dashboard
1. Откройте Railway Dashboard
2. Выберите проект → PostgreSQL сервис → Settings
3. Volumes → Add Volume
4. Mount Path: `/var/lib/postgresql/data`
5. Size: `10GB`
6. Create

### Шаг 2: Проверка подключения
```bash
railway volume list --service postgres
```

### Шаг 3: Перезапуск сервиса
```bash
railway restart --service postgres
```

### Шаг 4: Проверка работы БД
```bash
# Подключитесь к базе данных и проверьте, что данные на месте
railway run --service postgres psql -U postgres -d <your-database-name> -c "SELECT COUNT(*) FROM users;"
```

## Troubleshooting

### Volume не создается
- Убедитесь, что у вас есть права на создание volumes в проекте
- Проверьте, что выбран правильный сервис PostgreSQL
- Убедитесь, что путь монтирования правильный

### Данные не сохраняются
- Проверьте, что volume действительно подключен к сервису
- Убедитесь, что путь монтирования `/var/lib/postgresql/data` правильный
- Перезапустите сервис после создания volume

### Ошибки при подключении к БД
- Проверьте переменные окружения `DATABASE_URL`
- Убедитесь, что сервис PostgreSQL запущен
- Проверьте логи сервиса в Railway Dashboard

## Дополнительные ресурсы

- [Railway Documentation - Volumes](https://docs.railway.app/reference/volumes)
- [Railway CLI Documentation](https://docs.railway.app/develop/cli)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

**Примечание:** Процедура может немного отличаться в зависимости от версии Railway Dashboard и CLI. Всегда проверяйте актуальную документацию Railway.
