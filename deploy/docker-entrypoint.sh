#!/bin/sh
# Запуск uvicorn для Timeweb App Platform и Docker.
# - exec: uvicorn становится PID 1 — корректные SIGTERM/SIGINT.
# - UVICORN_HOST=:: по умолчанию: проба на «localhost» часто идёт на ::1; только 0.0.0.0
#   в контейнере тогда даёт connection refused. Если в образе нет IPv6 — задайте
#   в переменных окружения UVICORN_HOST=0.0.0.0.
set -eu
PORT="${PORT:-8080}"
UVICORN_HOST="${UVICORN_HOST:-::}"
cd /app/backend
exec uvicorn app:app --host "$UVICORN_HOST" --port "$PORT"
