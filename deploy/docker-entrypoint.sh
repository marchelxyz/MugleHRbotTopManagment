#!/bin/sh
# Запуск uvicorn для Timeweb App Platform и Docker.
# - exec: uvicorn становится PID 1 — корректные SIGTERM/SIGINT.
# - По умолчанию UVICORN_HOST=0.0.0.0: проба платформы обычно идёт по IPv4 (IP контейнера
#   или 127.0.0.1). Привязка только к :: на части стеков не принимает такой трафик —
#   в логах будет «Uvicorn running on [::]:8080», затем через ~2 мин shutdown и unhealthy.
# - Если поддержка подтвердила пробу только на localhost→::1, задайте UVICORN_HOST=::.
set -eu
PORT="${PORT:-8080}"
UVICORN_HOST="${UVICORN_HOST:-0.0.0.0}"
cd /app/backend
exec uvicorn app:app --host "$UVICORN_HOST" --port "$PORT"
