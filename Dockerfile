# Сборка: Vite (frontend) + FastAPI (backend), один процесс uvicorn.
# Корень контекста сборки — каталог репозитория (где лежит этот Dockerfile).

FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Пустой URL = API на том же origin (Telegram Mini App / один домен)
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM python:3.12-slim-bookworm
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend \
    SERVE_SPA=true \
    STATIC_ROOT=/app/frontend/dist \
    PORT=80 \
    UVICORN_HOST=::

COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY deploy/container_liveness_probe.py /usr/local/bin/container_liveness_probe.py
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

COPY backend/requirements.txt /app/backend/requirements.txt
# Зависимости в venv: не засоряем системный site-packages; pip обновляется до актуальной версии.
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r /app/backend/requirements.txt

ENV PATH="/opt/venv/bin:${PATH}" \
    VIRTUAL_ENV=/opt/venv

COPY backend/ /app/backend/
COPY --from=frontend-build /build/dist /app/frontend/dist

WORKDIR /app/backend
# Как в рабочих приложениях Timeweb (см. mariko_vld): EXPOSE и слушаемый порт совпадают.
# Иначе в панели PORT=80 + EXPOSE 8080 → проба на 8080, а uvicorn на 80 → unhealthy.
EXPOSE 80

# По документации Timeweb инструкция HEALTHCHECK в образе имеет приоритет над
# неявной пробой. Явный GET http://127.0.0.1:$PORT/health обходит localhost→::1.
# См. deploy/container_liveness_probe.py и deploy/TIMEWEB.md.
HEALTHCHECK --interval=15s --timeout=10s --start-period=120s --retries=8 \
    CMD /opt/venv/bin/python /usr/local/bin/container_liveness_probe.py

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
