#!/usr/bin/env bash
# Одноразовое копирование PostgreSQL: источник → целевая БД (например Railway → Timeweb).
# Требуются pg_dump и pg_restore (в образе приложения на Timeweb — пакет postgresql-client).
#
# Переменные окружения:
#   PG_MIGRATE_SOURCE_URL  — полный URL источника (публичный Railway), обязательно
#   PG_MIGRATE_TARGET_URL  — целевая БД; если не задан — берётся DATABASE_URL
#   PG_MIGRATE_CONFIRM     — должно быть ровно "yes", иначе скрипт не запустится
#
# Пример на Timeweb (консоль приложения / docker exec), цель — текущий DATABASE_URL:
#   export PG_MIGRATE_SOURCE_URL='postgresql://...railway...?sslmode=require'
#   export PG_MIGRATE_CONFIRM=yes
#   bash /app/deploy/pg_migrate_source_to_target.sh
#
# Локально (оба URL вручную):
#   export PG_MIGRATE_SOURCE_URL='...'
#   export PG_MIGRATE_TARGET_URL='postgresql://user:pass@host:5432/db?sslmode=require'
#   export PG_MIGRATE_CONFIRM=yes
#   bash deploy/pg_migrate_source_to_target.sh
#
# Опционально PG_MIGRATE_CLEAN=yes — перед загрузкой удалить объекты в целевой БД (--clean --if-exists).
# Опасно: сотрёт текущие объекты в целевой БД. Используйте только если цель — перезапись.
#
# Важно: по умолчанию целевая БД должна быть пустой. После миграции удалите PG_MIGRATE_SOURCE_URL из продакшена.

set -euo pipefail

if [[ "${PG_MIGRATE_CONFIRM:-}" != "yes" ]]; then
  echo "Отказ: задайте PG_MIGRATE_CONFIRM=yes (защита от случайного запуска)." >&2
  exit 1
fi

SOURCE_URL="${PG_MIGRATE_SOURCE_URL:-}"
TARGET_URL="${PG_MIGRATE_TARGET_URL:-${DATABASE_URL:-}}"

if [[ -z "$SOURCE_URL" ]]; then
  echo "Отказ: не задан PG_MIGRATE_SOURCE_URL." >&2
  exit 1
fi

if [[ -z "$TARGET_URL" ]]; then
  echo "Отказ: задайте PG_MIGRATE_TARGET_URL или DATABASE_URL (целевая БД)." >&2
  exit 1
fi

# pg_restore не понимает драйвер SQLAlchemy asyncpg в URL.
TARGET_URL="${TARGET_URL/postgresql+asyncpg:\/\//postgresql:\/\/}"

if [[ "$SOURCE_URL" == *"postgresql+asyncpg://"* ]]; then
  SOURCE_URL="${SOURCE_URL/postgresql+asyncpg:\/\//postgresql:\/\/}"
fi

if ! command -v pg_dump >/dev/null 2>&1 || ! command -v pg_restore >/dev/null 2>&1; then
  echo "Отказ: не найдены pg_dump/pg_restore. Установите postgresql-client или запустите образ приложения." >&2
  exit 1
fi

echo "Копирование: источник → цель (схема + данные), --no-owner --no-acl ..."
# Custom format по pipe; без владельцев/ACL — удобно при другом пользователе на Timeweb.
set -o pipefail
restore_args=(--no-owner --no-acl)
if [[ "${PG_MIGRATE_CLEAN:-}" == "yes" ]]; then
  echo "Внимание: PG_MIGRATE_CLEAN=yes — очистка существующих объектов в целевой БД." >&2
  restore_args+=(--clean --if-exists)
fi
pg_dump "$SOURCE_URL" -Fc --no-owner --no-acl | pg_restore "${restore_args[@]}" -d "$TARGET_URL"

echo "Готово. Проверьте приложение и удалите секрет источника из переменных окружения."
