# backend/gunicorn_config.py
# Конфигурация для production сервера с Gunicorn

import multiprocessing
import os

# Количество worker процессов
# Формула: (2 × CPU cores) + 1
# Можно переопределить через переменную окружения WORKERS
workers = int(os.getenv("WORKERS", multiprocessing.cpu_count() * 2 + 1))

# Класс worker'а - используем uvicorn workers для async поддержки
worker_class = "uvicorn.workers.UvicornWorker"

# Количество потоков на worker (для sync операций)
threads = 2

# Таймауты
timeout = 120  # Таймаут для worker'а (секунды)
keepalive = 5  # Keep-alive соединения

# Биндинг
bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"

# Логирование
accesslog = "-"  # stdout
errorlog = "-"   # stderr
loglevel = os.getenv("LOG_LEVEL", "info")

# Перезапуск workers при изменении кода (только для разработки)
reload = os.getenv("RELOAD", "false").lower() == "true"

# Preload приложения для экономии памяти
preload_app = True

# Максимальное количество запросов перед перезапуском worker'а (предотвращение утечек памяти)
max_requests = 1000
max_requests_jitter = 50

# Graceful timeout для завершения workers
graceful_timeout = 30
