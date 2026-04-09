# syntax=docker/dockerfile:1
# Сборка: Vite (frontend) + FastAPI (backend), один процесс uvicorn.
# Корень контекста сборки — каталог репозитория (где лежит этот Dockerfile).
# BuildKit: кэши pip/npm ускоряют повторные деплои на том же хосте.

FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY frontend/ ./
# Пустой URL = API на том же origin (Telegram Mini App / один домен)
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM python:3.12-slim-bookworm
# uv: параллельная установка и общий кэш быстрее pip на медленных каналах к PyPI (Timeweb и т.п.).
COPY --from=ghcr.io/astral-sh/uv:0.11.6 /uv /uvx /usr/local/bin/
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend \
    SERVE_SPA=true \
    STATIC_ROOT=/app/frontend/dist \
    PORT=80 \
    UVICORN_HOST=0.0.0.0 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

COPY backend/requirements.txt /app/backend/requirements.txt
# BuildKit: кэш uv между сборками на том же хосте.
RUN --mount=type=cache,target=/root/.cache/uv \
    uv venv /opt/venv \
    && uv pip install --python /opt/venv/bin/python -r /app/backend/requirements.txt

ENV PATH="/opt/venv/bin:${PATH}" \
    VIRTUAL_ENV=/opt/venv

COPY backend/ /app/backend/
COPY --from=frontend-build /build/dist /app/frontend/dist

WORKDIR /app/backend
# Как в рабочих приложениях Timeweb (см. mariko_vld): EXPOSE и слушаемый порт совпадают.
# Иначе в панели PORT=80 + EXPOSE 8080 → проба на 8080, а uvicorn на 80 → unhealthy.
EXPOSE 80

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
