"""Фоновая синхронизация данных из внешней PostgreSQL (например Railway) в основную БД (Timeweb).

Первый успешный цикл (пока ``initial_full_sync_done`` в ``dual_db_sync_state`` = false):
полное копирование — UPSERT всех строк с источника (INSERT … ON CONFLICT DO UPDATE).

Дальше каждые ``DB_SYNC_INTERVAL_SECONDS``: только строки, которых ещё нет на приёмнике по PK
(INSERT … ON CONFLICT DO NOTHING).

Чтобы снова выполнить полный проход: ``UPDATE dual_db_sync_state SET initial_full_sync_done = false WHERE id = 1``.

Таблица ``schema_migrations`` не в SQLAlchemy metadata — обрабатывается отдельно.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

from fastapi import FastAPI
from sqlalchemy import func, select, text
from sqlalchemy.engine.row import Row
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncConnection, create_async_engine
from sqlalchemy.schema import Table
from sqlalchemy.dialects.postgresql import insert as pg_insert

from config import settings
from database import Base, engine as target_engine

logger = logging.getLogger(__name__)


def _normalize_postgres_async_url(url: str) -> str:
    """Превращает postgresql:// в postgresql+asyncpg:// для async-движка."""
    u = url.strip()
    if u.startswith("postgresql+asyncpg://"):
        return u
    if u.startswith("postgresql://"):
        return u.replace("postgresql://", "postgresql+asyncpg://", 1)
    return u


def _create_source_engine() -> AsyncEngine:
    """Создаёт пул соединений только к БД-источнику (чтение)."""
    return create_async_engine(
        _normalize_postgres_async_url(settings.SYNC_SOURCE_DATABASE_URL),
        echo=settings.SQLALCHEMY_ECHO,
        pool_pre_ping=True,
        pool_size=3,
        max_overflow=2,
        pool_recycle=1800,
    )


def _sorted_orm_tables() -> list[Table]:
    """Таблицы моделей в порядке, уважающем внешние ключи."""
    import models  # noqa: F401 — регистрация в Base.metadata

    return list(Base.metadata.sorted_tables)


DUAL_SYNC_STATE_TABLE = "dual_db_sync_state"


async def _ensure_dual_db_sync_state_table(conn: AsyncConnection) -> None:
    """Создаёт служебную таблицу с флагом завершения первого полного копирования."""
    await conn.execute(
        text(
            f"""
            CREATE TABLE IF NOT EXISTS {DUAL_SYNC_STATE_TABLE} (
                id SMALLINT PRIMARY KEY,
                initial_full_sync_done BOOLEAN NOT NULL DEFAULT FALSE
            )
            """
        )
    )
    await conn.execute(
        text(
            f"""
            INSERT INTO {DUAL_SYNC_STATE_TABLE} (id, initial_full_sync_done)
            VALUES (1, FALSE)
            ON CONFLICT (id) DO NOTHING
            """
        )
    )


async def _read_initial_full_sync_done(conn: AsyncConnection) -> bool:
    """True, если полный UPSERT уже успешно завершался ранее."""
    if not await _table_exists(conn, DUAL_SYNC_STATE_TABLE):
        return False
    row = await conn.execute(
        text(
            f"SELECT initial_full_sync_done FROM {DUAL_SYNC_STATE_TABLE} WHERE id = 1"
        )
    )
    val = row.scalar_one_or_none()
    return bool(val)


async def _mark_initial_full_sync_done(conn: AsyncConnection) -> None:
    """Помечает, что дальше достаточно режима «только новые по PK»."""
    await conn.execute(
        text(
            f"UPDATE {DUAL_SYNC_STATE_TABLE} SET initial_full_sync_done = TRUE WHERE id = 1"
        )
    )


async def _table_exists(conn: AsyncConnection, table_name: str) -> bool:
    """Проверяет наличие таблицы в схеме public."""
    q = text(
        """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = :name
        )
        """
    )
    row = (await conn.execute(q, {"name": table_name})).scalar_one()
    return bool(row)


def _safe_sql_identifier(name: str) -> bool:
    """Допускает только безопасные имена таблиц/колонок из metadata."""
    return bool(name) and all(c.isalnum() or c == "_" for c in name)


def _integer_pk_column(table: Table) -> Optional[Any]:
    """Возвращает единственный столбец PK, если это целочисленный тип (Integer/BigInteger)."""
    pk = list(table.primary_key.columns)
    if len(pk) != 1:
        return None
    col = pk[0]
    tname = type(col.type).__name__
    if tname not in ("Integer", "BigInteger"):
        return None
    return col


async def _existing_pks_on_target(
    target_conn: AsyncConnection, table: Table, pk_col: Any, pks: list[Any]
) -> set[Any]:
    """Множество PK, которые уже есть на приёмнике."""
    if not pks:
        return set()
    stmt = select(pk_col).where(pk_col.in_(pks))
    result = await target_conn.execute(stmt)
    return {r[0] for r in result.fetchall()}


def _row_to_insert_map(table: Table, row: Row[Any]) -> dict[str, Any]:
    """Словарь значений для INSERT по строке источника."""
    m = row._mapping
    return {c.key: m[c.key] for c in table.columns}


def _upsert_stmt_for_row(table: Table, pk_col: Any, payload: dict[str, Any]) -> Any:
    """INSERT … ON CONFLICT (pk) DO UPDATE для всех не-PK столбцов."""
    ins = pg_insert(table).values(**payload)
    excluded = ins.excluded
    set_: dict[str, Any] = {}
    for col in table.columns:
        if col.key == pk_col.key:
            continue
        set_[col.key] = excluded[col.key]
    if not set_:
        return ins.on_conflict_do_nothing(index_elements=[pk_col.key])
    return ins.on_conflict_do_update(index_elements=[pk_col.key], set_=set_)


async def _sync_single_table(
    source_conn: AsyncConnection,
    target_conn: AsyncConnection,
    table: Table,
    batch_size: int,
    *,
    initial_full_pass: bool,
) -> int:
    """Синхронизирует одну таблицу. При initial_full_pass — UPSERT всех строк, иначе только новые PK."""
    pk_col = _integer_pk_column(table)
    if pk_col is None:
        logger.warning("Синхронизация: пропуск %s (нужен один целочисленный PK)", table.name)
        return 0

    if not await _table_exists(source_conn, table.name):
        logger.warning("Синхронизация: на источнике нет таблицы %s", table.name)
        return 0
    if not await _table_exists(target_conn, table.name):
        logger.warning("Синхронизация: на приёмнике нет таблицы %s", table.name)
        return 0

    written = 0
    cursor: Any = None

    while True:
        if cursor is None:
            stmt = select(table).order_by(pk_col).limit(batch_size)
        else:
            stmt = (
                select(table).where(pk_col > cursor).order_by(pk_col).limit(batch_size)
            )
        result = await source_conn.execute(stmt)
        rows = result.fetchall()
        if not rows:
            break

        if initial_full_pass:
            for row in rows:
                payload = _row_to_insert_map(table, row)
                stmt_upsert = _upsert_stmt_for_row(table, pk_col, payload)
                await target_conn.execute(stmt_upsert)
                written += 1
        else:
            pks = [row._mapping[pk_col.key] for row in rows]
            existing = await _existing_pks_on_target(target_conn, table, pk_col, pks)
            to_insert = [row for row in rows if row._mapping[pk_col.key] not in existing]

            for row in to_insert:
                payload = _row_to_insert_map(table, row)
                ins = pg_insert(table).values(**payload)
                ins = ins.on_conflict_do_nothing(index_elements=[pk_col.key])
                await target_conn.execute(ins)
                written += 1

        cursor = rows[-1]._mapping[pk_col.key]

    if written:
        mode = "полный UPSERT" if initial_full_pass else "новые строки"
        logger.info("Синхронизация: %s — %s, обработано: %s", table.name, mode, written)
    return written


async def _sync_schema_migrations(
    source_conn: AsyncConnection,
    target_conn: AsyncConnection,
    batch_size: int,
    *,
    initial_full_pass: bool,
) -> int:
    """Синхронизирует schema_migrations: полный проход — UPSERT по migration_name, далее только новые."""
    if not await _table_exists(source_conn, "schema_migrations"):
        return 0
    if not await _table_exists(target_conn, "schema_migrations"):
        return 0

    written = 0
    cursor: Optional[int] = None
    while True:
        if cursor is None:
            q_src = text(
                "SELECT id, migration_name, applied_at FROM schema_migrations ORDER BY id LIMIT :lim"
            )
            params: dict[str, Any] = {"lim": batch_size}
        else:
            q_src = text(
                """
                SELECT id, migration_name, applied_at FROM schema_migrations
                WHERE id > :c ORDER BY id LIMIT :lim
                """
            )
            params = {"c": cursor, "lim": batch_size}

        src_rows = (await source_conn.execute(q_src, params)).fetchall()
        if not src_rows:
            break

        for r in src_rows:
            _, name, applied_at = r[0], r[1], r[2]
            if initial_full_pass:
                ins = text(
                    """
                    INSERT INTO schema_migrations (migration_name, applied_at)
                    VALUES (:migration_name, :applied_at)
                    ON CONFLICT (migration_name) DO UPDATE
                    SET applied_at = EXCLUDED.applied_at
                    """
                )
                await target_conn.execute(
                    ins, {"migration_name": name, "applied_at": applied_at}
                )
                written += 1
            else:
                check = text(
                    "SELECT 1 FROM schema_migrations WHERE migration_name = :n LIMIT 1"
                )
                exists = (await target_conn.execute(check, {"n": name})).first()
                if exists:
                    continue
                ins = text(
                    """
                    INSERT INTO schema_migrations (migration_name, applied_at)
                    VALUES (:migration_name, :applied_at)
                    ON CONFLICT (migration_name) DO NOTHING
                    """
                )
                await target_conn.execute(
                    ins, {"migration_name": name, "applied_at": applied_at}
                )
                written += 1

        cursor = src_rows[-1][0]

    if written:
        mode = "полный UPSERT" if initial_full_pass else "новые записи"
        logger.info("Синхронизация: schema_migrations — %s, обработано: %s", mode, written)
    return written


async def _realign_serial_sequences(target_conn: AsyncConnection) -> None:
    """Поднимает SERIAL/IDENTITY до MAX(pk), чтобы следующие INSERT без явного id не конфликтовали."""
    for table in _sorted_orm_tables():
        pk_col = _integer_pk_column(table)
        if pk_col is None:
            continue
        tname, pk_name = table.name, pk_col.key
        if not (_safe_sql_identifier(tname) and _safe_sql_identifier(pk_name)):
            continue
        seq_row = await target_conn.execute(
            text("SELECT pg_get_serial_sequence(:reg, :pk)"),
            {"reg": f"public.{tname}", "pk": pk_name},
        )
        seq_name = seq_row.scalar_one_or_none()
        if seq_name is None:
            continue
        mx_result = await target_conn.execute(select(func.max(table.c[pk_name])))
        max_pk = mx_result.scalar_one_or_none()
        if max_pk is None:
            continue
        next_val = max(int(max_pk), 1)
        await target_conn.execute(
            text("SELECT setval(CAST(:seq AS regclass), :nv, true)"),
            {"seq": seq_name, "nv": next_val},
        )


async def run_one_sync_pass(source_engine: AsyncEngine) -> dict[str, int]:
    """Один проход по таблицам. Возвращает счётчики обработанных строк по имени таблицы."""
    stats: dict[str, int] = {}
    tables = _sorted_orm_tables()

    async with target_engine.begin() as setup_conn:
        await _ensure_dual_db_sync_state_table(setup_conn)
        initial_full_done = await _read_initial_full_sync_done(setup_conn)

    initial_full_pass = not initial_full_done
    if initial_full_pass:
        logger.info(
            "Синхронизация: первый цикл — полное копирование (UPSERT), затем только новые строки по PK."
        )

    sync_success = True
    async with source_engine.connect() as source_conn:
        for table in tables:
            try:
                async with target_engine.begin() as target_conn:
                    n = await _sync_single_table(
                        source_conn,
                        target_conn,
                        table,
                        settings.DB_SYNC_BATCH_SIZE,
                        initial_full_pass=initial_full_pass,
                    )
                if n:
                    stats[table.name] = n
            except Exception:
                sync_success = False
                logger.exception("Синхронизация: ошибка таблицы %s", table.name)

        try:
            async with target_engine.begin() as target_conn:
                sm = await _sync_schema_migrations(
                    source_conn,
                    target_conn,
                    settings.DB_SYNC_BATCH_SIZE,
                    initial_full_pass=initial_full_pass,
                )
            if sm:
                stats["schema_migrations"] = sm
        except Exception:
            sync_success = False
            logger.exception("Синхронизация: ошибка schema_migrations")

        if sync_success and initial_full_pass:
            try:
                async with target_engine.begin() as mark_conn:
                    await _mark_initial_full_sync_done(mark_conn)
                logger.info(
                    "Синхронизация: полный проход завершён; следующие циклы — только отсутствующие PK."
                )
            except Exception:
                logger.exception(
                    "Синхронизация: не удалось сохранить флаг initial_full_sync_done"
                )

        if stats:
            try:
                async with target_engine.begin() as seq_conn:
                    await _realign_serial_sequences(seq_conn)
            except Exception:
                logger.exception(
                    "Синхронизация: не удалось выровнять последовательности SERIAL"
                )

    return stats


_source_engine: Optional[AsyncEngine] = None


def _get_or_create_source_engine() -> AsyncEngine:
    global _source_engine
    if _source_engine is None:
        _source_engine = _create_source_engine()
    return _source_engine


async def dispose_source_engine() -> None:
    """Закрывает пул к источнику (при остановке приложения)."""
    global _source_engine
    if _source_engine is not None:
        await _source_engine.dispose()
        _source_engine = None


async def run_forever() -> None:
    """Периодически повторяет синхронизацию до отмены задачи."""
    logger.info(
        "Фоновая синхронизация БД (источник → приёмник) каждые %s с, пакет %s",
        settings.DB_SYNC_INTERVAL_SECONDS,
        settings.DB_SYNC_BATCH_SIZE,
    )
    eng = _get_or_create_source_engine()
    try:
        while True:
            try:
                stats = await run_one_sync_pass(eng)
                if stats:
                    logger.info("Синхронизация: итог цикла %s", stats)
            except Exception:
                logger.exception("Синхронизация: сбой цикла")
            await asyncio.sleep(settings.DB_SYNC_INTERVAL_SECONDS)
    except asyncio.CancelledError:
        logger.info("Фоновая синхронизация БД остановлена")
        raise
    finally:
        await dispose_source_engine()


def start_dual_db_sync_background(app: FastAPI) -> None:
    """Запускает asyncio-задачу синхронизации (если включено в настройках)."""
    if not settings.DB_SYNC_ENABLED:
        return
    src = settings.SYNC_SOURCE_DATABASE_URL.strip()
    if not src:
        logger.warning(
            "DB_SYNC_ENABLED=true, но SYNC_SOURCE_DATABASE_URL пуст — синхронизация не запущена"
        )
        return
    app.state._db_sync_task = asyncio.create_task(run_forever())
