"""Фоновая инициализация после запуска ASGI: схема БД, миграции, Redis.

Сервер начинает слушать порт до завершения этих шагов, чтобы /health отвечал
сразу (требования Timeweb App Platform и др.).
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

from sqlalchemy import select, text

from config import settings
from database import Base, engine
from redis_cache import redis_cache

logger = logging.getLogger(__name__)

CREATE_TABLES_LOCK_KEY = 1234567891
MIGRATION_LOCK_KEY = 1234567890


def _split_sql_commands(sql_text: str) -> list[str]:
    """Разбивает SQL на команды, убирает комментарии, учитывает dollar-quoted блоки."""
    sql_text = re.sub(r"/\*.*?\*/", "", sql_text, flags=re.DOTALL)

    lines: list[str] = []
    for line in sql_text.split("\n"):
        if "--" in line:
            line = line.split("--")[0]
        line = line.strip()
        if line:
            lines.append(line)

    sql_clean = " ".join(lines)

    commands: list[str] = []
    current_command: list[str] = []
    in_dollar_quote = False
    dollar_tag: str | None = None
    i = 0

    while i < len(sql_clean):
        if not in_dollar_quote and sql_clean[i] == "$":
            tag_start = i
            j = i + 1
            while j < len(sql_clean) and sql_clean[j] != "$":
                j += 1

            if j < len(sql_clean):
                dollar_tag = sql_clean[tag_start : j + 1]
                in_dollar_quote = True
                current_command.append(dollar_tag)
                i = j + 1
                continue

        if in_dollar_quote and sql_clean[i] == "$":
            if dollar_tag is not None and i + len(dollar_tag) <= len(sql_clean):
                potential_tag = sql_clean[i : i + len(dollar_tag)]
                if potential_tag == dollar_tag:
                    current_command.append(dollar_tag)
                    i += len(dollar_tag)
                    in_dollar_quote = False
                    dollar_tag = None
                    continue

        current_command.append(sql_clean[i])

        if not in_dollar_quote and sql_clean[i] == ";":
            cmd = "".join(current_command).strip()
            if cmd:
                commands.append(cmd)
            current_command = []

        i += 1

    if current_command:
        cmd = "".join(current_command).strip()
        if cmd:
            commands.append(cmd)

    return commands


async def run_background_startup() -> None:
    """Создание таблиц, SQL-миграции, подключение Redis."""
    async with engine.connect() as conn:
        async with conn.begin():
            await conn.execute(text(f"SELECT pg_advisory_lock({CREATE_TABLES_LOCK_KEY})"))
        try:
            async with conn.begin():
                await conn.run_sync(Base.metadata.create_all)
        except Exception as e:
            logger.warning(
                "⚠️ metadata.create_all завершился с ошибкой (таблицы могли быть созданы другим воркером): %s",
                e,
            )
        finally:
            async with conn.begin():
                await conn.execute(text(f"SELECT pg_advisory_unlock({CREATE_TABLES_LOCK_KEY})"))

    migrations_dir = Path(__file__).parent / "migrations"
    if not migrations_dir.exists():
        logger.error("❌ Папка migrations не найдена: %s", migrations_dir)
        logger.error("📂 Текущая директория: %s", Path(__file__).parent)
        logger.error("📂 Абсолютный путь: %s", Path(__file__).parent.absolute())
    else:
        logger.info("✅ Папка migrations найдена: %s", migrations_dir)

        async with engine.connect() as conn:
            logger.info("🔒 Ожидание блокировки для применения миграций...")
            async with conn.begin():
                await conn.execute(text(f"SELECT pg_advisory_lock({MIGRATION_LOCK_KEY})"))
            logger.info("🔓 Блокировка получена, начинаем применение миграций")

            try:
                create_table_sql = """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    id SERIAL PRIMARY KEY,
                    migration_name VARCHAR(255) NOT NULL UNIQUE,
                    applied_at TIMESTAMP DEFAULT NOW() NOT NULL
                )
                """

                create_index_sql = """
                CREATE INDEX IF NOT EXISTS idx_schema_migrations_name ON schema_migrations(migration_name)
                """

                try:
                    async with conn.begin():
                        await conn.execute(text(create_table_sql))
                        await conn.execute(text(create_index_sql))
                    logger.info("✅ Таблица schema_migrations создана/проверена")
                except Exception as e:
                    logger.error("❌ Ошибка при создании таблицы schema_migrations: %s", e)
                    raise

                async with conn.begin():
                    result = await conn.execute(select(text("migration_name")).select_from(text("schema_migrations")))
                    applied_migrations = {row[0] for row in result.fetchall()}
                logger.info("📋 Уже применено миграций: %s", len(applied_migrations))

                migration_files = sorted(migrations_dir.glob("*.sql"))

                if not migration_files:
                    logger.warning("⚠️ Файлы миграций не найдены")
                else:
                    logger.info("🔍 Найдено %s файлов миграций", len(migration_files))

                    for migration_file in migration_files:
                        migration_name = migration_file.name

                        if migration_name in applied_migrations:
                            logger.info("⏭️  Миграция %s уже применена, пропускаем", migration_name)
                            continue

                        logger.info("📄 Применение миграции: %s", migration_name)

                        try:
                            with open(migration_file, encoding="utf-8") as f:
                                migration_sql = f.read()

                            async with conn.begin():
                                sql_commands = _split_sql_commands(migration_sql)

                                for idx, sql_command in enumerate(sql_commands, 1):
                                    if sql_command.strip():
                                        logger.debug(
                                            "  Выполнение команды %s/%s: %s...",
                                            idx,
                                            len(sql_commands),
                                            sql_command[:50],
                                        )
                                        await conn.execute(text(sql_command))

                                insert_migration = text(
                                    "INSERT INTO schema_migrations (migration_name) VALUES (:name) ON CONFLICT DO NOTHING"
                                )
                                await conn.execute(insert_migration, {"name": migration_name})

                            logger.info("✅ Миграция %s применена успешно", migration_name)

                        except Exception as e:
                            error_msg = f"❌ КРИТИЧЕСКАЯ ОШИБКА при применении миграции {migration_name}: {e}"
                            logger.error(error_msg)
                            logger.exception(e)
                            raise RuntimeError(error_msg) from e

                    logger.info("🎉 Применение миграций завершено")
            finally:
                async with conn.begin():
                    await conn.execute(text(f"SELECT pg_advisory_unlock({MIGRATION_LOCK_KEY})"))
                logger.info("🔓 Блокировка освобождена")

    if not settings.REDIS_ENABLED:
        logger.info("Redis отключён (REDIS_ENABLED=false), подключение не выполняется.")
        return

    try:
        await redis_cache.connect()
    except Exception as e:
        logger.warning(
            "⚠️ Не удалось подключиться к Redis: %s. Кеширование будет недоступно.",
            e,
        )
