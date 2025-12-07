# Multi-stage Dockerfile для сборки фронтенда и запуска бэкенда

# ============================================
# Stage 1: Сборка фронтенда
# ============================================
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Копируем package.json и package-lock.json (если есть)
COPY frontend/package*.json ./

# Устанавливаем зависимости
# Используем npm ci если есть package-lock.json, иначе npm install
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Копируем исходный код фронтенда
COPY frontend/ ./

# Собираем фронтенд для продакшена
RUN npm run build

# ============================================
# Stage 2: Запуск бэкенда с раздачей статики
# ============================================
FROM python:3.11-slim

WORKDIR /app

# Устанавливаем системные зависимости
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Копируем requirements.txt и устанавливаем Python зависимости
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем код бэкенда
COPY backend/ ./backend/

# Копируем собранный фронтенд из предыдущего stage
COPY --from=frontend-builder /app/frontend/dist ./static

# Создаем директорию для логов (если нужно)
RUN mkdir -p /app/logs

# Устанавливаем переменные окружения по умолчанию
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Открываем порт
EXPOSE 8000

# Команда запуска приложения
CMD ["gunicorn", "backend.app:app", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--workers", "4"]
