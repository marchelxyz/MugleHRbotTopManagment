#!/usr/bin/env python3
"""
Скрипт для запуска ежемесячных задач через Railway Cron.
Railway Cron будет запускать этот скрипт по расписанию.
"""
import os
import sys
import httpx
import asyncio

# Получаем URL основного сервиса из переменных окружения
# Railway предоставляет RAILWAY_SERVICE_URL для внутренних запросов между сервисами
# Это более эффективно, чем использовать публичный домен
BACKEND_URL = (
    os.getenv("RAILWAY_SERVICE_URL") or  # Внутренний URL (предпочтительно)
    os.getenv("RAILWAY_PUBLIC_DOMAIN") or  # Публичный домен Railway
    os.getenv("BACKEND_URL")  # Кастомный URL
)
if not BACKEND_URL:
    print("ERROR: Не установлен BACKEND_URL, RAILWAY_PUBLIC_DOMAIN или RAILWAY_SERVICE_URL")
    sys.exit(1)

# Добавляем протокол если его нет
if not BACKEND_URL.startswith("http"):
    BACKEND_URL = f"https://{BACKEND_URL}"

ADMIN_API_KEY = os.getenv("ADMIN_API_KEY")
if not ADMIN_API_KEY:
    print("ERROR: ADMIN_API_KEY не установлен")
    sys.exit(1)

ENDPOINT = f"{BACKEND_URL}/scheduler/run-monthly-tasks"

async def main():
    """Выполняет HTTP запрос к эндпоинту ежемесячных задач."""
    print(f"--- Запуск ежемесячных задач через Railway Cron ---")
    print(f"--- URL: {ENDPOINT} ---")
    
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            response = await client.post(
                ENDPOINT,
                headers={"X-Cron-Secret": ADMIN_API_KEY}
            )
            response.raise_for_status()
            result = response.json()
            print(f"--- Успешно выполнено: {result} ---")
            return 0
        except httpx.HTTPStatusError as e:
            print(f"--- ОШИБКА HTTP: {e.response.status_code} - {e.response.text} ---")
            return 1
        except Exception as e:
            print(f"--- ОШИБКА: {e} ---")
            return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
