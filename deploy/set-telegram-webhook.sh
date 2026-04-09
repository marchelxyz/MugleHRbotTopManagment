#!/bin/sh
# Установка webhook Telegram → тот же хостинг, где крутится uvicorn (FastAPI).
#
# Зачем: уведомления о регистрации с кнопками «Принять / Отказать» отправляет ваш
# бэкенд через Bot API, а нажатие кнопки Telegram доставляет на URL webhook.
# Если webhook не назначен или указывает на другой сервер — в «админской беседе»
# кнопки не сработают (одобрение остаётся только через веб-админку).
#
# Требования: HTTPS, публичный URL, порт доступен с api.telegram.org.
# Один контейнер/процесс: docker-entrypoint уже поднимает uvicorn с маршрутом
# POST /telegram/webhook — отдельно «запускать бота» не нужно, только setWebhook.
#
# Примеры (на сервере или локально с curl):
#   export TELEGRAM_BOT_TOKEN="123:ABC..."
#   export APP_PUBLIC_URL="https://ваш-домен.example"
#   sh deploy/set-telegram-webhook.sh set
#
#   sh deploy/set-telegram-webhook.sh info
#   sh deploy/set-telegram-webhook.sh delete
#
set -eu

usage() {
  echo "Использование:" >&2
  echo "  TELEGRAM_BOT_TOKEN=... APP_PUBLIC_URL=https://домен $(basename "$0") set" >&2
  echo "  TELEGRAM_BOT_TOKEN=... $(basename "$0") info" >&2
  echo "  TELEGRAM_BOT_TOKEN=... $(basename "$0") delete" >&2
  exit 1
}

cmd="${1:-set}"
TOKEN="${TELEGRAM_BOT_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  echo "Ошибка: задайте TELEGRAM_BOT_TOKEN" >&2
  usage
fi

API_ROOT="https://api.telegram.org/bot${TOKEN}"

case "$cmd" in
  set)
    APP_URL="${APP_PUBLIC_URL:-}"
    if [ -z "$APP_URL" ]; then
      echo "Ошибка: для set задайте APP_PUBLIC_URL (https://..., без / в конце)" >&2
      usage
    fi
    APP_URL="${APP_URL%/}"
    WH_URL="${APP_URL}/telegram/webhook"
    echo "Назначаю webhook: ${WH_URL}"
    curl -sS -X POST "${API_ROOT}/setWebhook" --data-urlencode "url=${WH_URL}"
    echo
    ;;
  info)
    curl -sS "${API_ROOT}/getWebhookInfo"
    echo
    ;;
  delete)
    curl -sS -X POST "${API_ROOT}/deleteWebhook"
    echo
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    echo "Неизвестная команда: $cmd" >&2
    usage
    ;;
esac
