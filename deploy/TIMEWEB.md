# Timeweb App Platform — пути и проверки

## Контекст сборки Docker

- **Корень проекта (build context):** каталог репозитория, где лежит `Dockerfile` (например клон на сервере: `/home/.../MugleHRbotTopManagment`).
- **Файл образа:** `Dockerfile` в корне репозитория.

## Внутри контейнера (после сборки)

| Назначение | Путь |
|------------|------|
| Рабочая директория процесса | `/app/backend` |
| Код FastAPI | `/app/backend/` |
| Собранный фронт (Vite `dist`) | `/app/frontend/dist` |
| `index.html` | `/app/frontend/dist/index.html` |
| Статика JS/CSS | `/app/frontend/dist/assets/` |

Переменные по умолчанию в образе: `SERVE_SPA=true`, `STATIC_ROOT=/app/frontend/dist`, `PORT=8080`.

## Health check (состояние сервиса)

- **HTTP:** `GET /health`
- **Ожидаемый ответ:** JSON `{"status":"ok"}` и код **200**.

В панели Timeweb укажите путь проверки: **`/health`** (без домена, только path).

## Порт

- По умолчанию приложение слушает **`PORT`** (в образе **8080**).
- Если платформа подставляет свой `PORT` (часто 8080), оставьте как есть или задайте переменную окружения `PORT` в настройках приложения.

## Переменные окружения (обязательно задать в сервисе)

Все секреты и строки подключения из вашего `.env` / продакшена: `DATABASE_URL`, `ADMIN_API_KEY`, Telegram, при необходимости `CORS_ORIGINS` (ваш публичный URL через запятую), SMTP, S3 и т.д.

**Redis не обязателен:** без Redis приложение работает, кеш отключён.

## Сборка локально

```bash
docker build -t hr-spasibo:latest .
docker run --env-file .env -p 8080:8080 hr-spasibo:latest
```

Откройте `http://localhost:8080/` — SPA; `http://localhost:8080/health` — проверка.
