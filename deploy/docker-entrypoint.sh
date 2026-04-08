#!/bin/sh
# Запуск uvicorn для Timeweb App Platform и Docker.
# - exec: uvicorn становится PID 1 — корректные SIGTERM/SIGINT.
# - По умолчанию UVICORN_HOST=0.0.0.0: проба платформы обычно идёт по IPv4 (IP контейнера
#   или 127.0.0.1). Привязка только к :: на части стеков не принимает такой трафик —
#   в логах будет «Uvicorn running on [::]:…», затем через ~2 мин shutdown и unhealthy.
# - Если поддержка подтвердила пробу только на localhost→::1, задайте UVICORN_HOST=::.
set -eu
# Дефолт 80 — как у рабочего деплоя Timeweb (mariko_vld + PORT в панели). Локально: -e PORT=8080 -p 8080:8080
PORT="${PORT:-80}"
UVICORN_HOST="${UVICORN_HOST:-0.0.0.0}"
cd /app/backend
# Интерпретатор из venv (см. Dockerfile /opt/venv); не полагаемся только на PATH в окружении платформы.
exec /opt/venv/bin/uvicorn app:app --host "$UVICORN_HOST" --port "$PORT"
