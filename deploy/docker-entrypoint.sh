#!/bin/sh
# Запуск uvicorn для Timeweb App Platform и Docker.
# - exec: uvicorn становится PID 1 — корректные SIGTERM/SIGINT.
# - По умолчанию UVICORN_HOST=:: (dual-stack на Linux): HTTP-пробы платформы часто идут на
#   http://localhost:PORT/…; в контейнере localhost может резолвиться в ::1. При привязке
#   только 0.0.0.0 на ::1 никто не слушает, хотя с 172.18.x.x (IPv4) уже 200. Uvicorn с
#   --host :: на Linux принимает и IPv4, и IPv6 (IPV6_V6ONLY=0).
# - Если на стеке только IPv4 и что-то ломается — задайте UVICORN_HOST=0.0.0.0 в переменных.
set -eu
# Дефолт 80 — как у рабочего деплоя Timeweb (mariko_vld + PORT в панели). Локально: -e PORT=8080 -p 8080:8080
PORT="${PORT:-80}"
UVICORN_HOST="${UVICORN_HOST:-::}"
cd /app/backend
# Интерпретатор из venv (см. Dockerfile /opt/venv); не полагаемся только на PATH в окружении платформы.
exec /opt/venv/bin/uvicorn app:app --host "$UVICORN_HOST" --port "$PORT"
