from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from starlette.middleware.base import BaseHTTPMiddleware
from pathlib import Path
import logging
import re
from sqlalchemy import text, select

from database import engine, Base
from routers import users, transactions, market, admin, banners, roulette, scheduler, telegram, sessions, shared_gifts, cache, app_settings, notifications
from redis_cache import redis_cache

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    CREATE_TABLES_LOCK_KEY = 1234567891
    async with engine.connect() as conn:
        async with conn.begin():
            await conn.execute(text(f"SELECT pg_advisory_lock({CREATE_TABLES_LOCK_KEY})"))
        try:
            async with conn.begin():
                await conn.run_sync(Base.metadata.create_all)
        except Exception as e:
            logger.warning(f"⚠️ metadata.create_all завершился с ошибкой (таблицы могли быть созданы другим воркером): {e}")
        finally:
            async with conn.begin():
                await conn.execute(text(f"SELECT pg_advisory_unlock({CREATE_TABLES_LOCK_KEY})"))
    
    migrations_dir = Path(__file__).parent / "migrations"
    if not migrations_dir.exists():
        logger.error(f"❌ Папка migrations не найдена: {migrations_dir}")
        logger.error(f"📂 Текущая директория: {Path(__file__).parent}")
        logger.error(f"📂 Абсолютный путь: {Path(__file__).parent.absolute()}")
    else:
        logger.info(f"✅ Папка migrations найдена: {migrations_dir}")
        
        MIGRATION_LOCK_KEY = 1234567890
        
        def split_sql_commands(sql_text):
            """Разбивает SQL текст на отдельные команды, удаляя комментарии и учитывая dollar-quoted блоки"""
            sql_text = re.sub(r'/\*.*?\*/', '', sql_text, flags=re.DOTALL)
            
            lines = []
            for line in sql_text.split('\n'):
                if '--' in line:
                    line = line.split('--')[0]
                line = line.strip()
                if line:
                    lines.append(line)
            
            sql_clean = ' '.join(lines)
            
            commands = []
            current_command = []
            in_dollar_quote = False
            dollar_tag = None
            i = 0
            
            while i < len(sql_clean):
                if not in_dollar_quote and sql_clean[i] == '$':
                    tag_start = i
                    j = i + 1
                    while j < len(sql_clean) and sql_clean[j] != '$':
                        j += 1
                    
                    if j < len(sql_clean):
                        dollar_tag = sql_clean[tag_start:j + 1]
                        in_dollar_quote = True
                        current_command.append(dollar_tag)
                        i = j + 1
                        continue
                
                if in_dollar_quote and sql_clean[i] == '$':
                    if i + len(dollar_tag) <= len(sql_clean):
                        potential_tag = sql_clean[i:i + len(dollar_tag)]
                        if potential_tag == dollar_tag:
                            current_command.append(dollar_tag)
                            i += len(dollar_tag)
                            in_dollar_quote = False
                            dollar_tag = None
                            continue
                
                current_command.append(sql_clean[i])
                
                if not in_dollar_quote and sql_clean[i] == ';':
                    cmd = ''.join(current_command).strip()
                    if cmd:
                        commands.append(cmd)
                    current_command = []
                
                i += 1
            
            if current_command:
                cmd = ''.join(current_command).strip()
                if cmd:
                    commands.append(cmd)
            
            return commands
        
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
                    logger.error(f"❌ Ошибка при создании таблицы schema_migrations: {e}")
                    raise
                
                async with conn.begin():
                    result = await conn.execute(select(text("migration_name")).select_from(text("schema_migrations")))
                    applied_migrations = {row[0] for row in result.fetchall()}
                logger.info(f"📋 Уже применено миграций: {len(applied_migrations)}")
                
                migration_files = sorted([f for f in migrations_dir.glob("*.sql")])
                
                if not migration_files:
                    logger.warning("⚠️ Файлы миграций не найдены")
                else:
                    logger.info(f"🔍 Найдено {len(migration_files)} файлов миграций")
                    
                    for migration_file in migration_files:
                        migration_name = migration_file.name
                        
                        if migration_name in applied_migrations:
                            logger.info(f"⏭️  Миграция {migration_name} уже применена, пропускаем")
                            continue
                        
                        logger.info(f"📄 Применение миграции: {migration_name}")
                        
                        try:
                            with open(migration_file, 'r', encoding='utf-8') as f:
                                migration_sql = f.read()
                            
                            async with conn.begin():
                                sql_commands = split_sql_commands(migration_sql)
                                
                                for i, sql_command in enumerate(sql_commands, 1):
                                    if sql_command.strip():
                                        logger.debug(f"  Выполнение команды {i}/{len(sql_commands)}: {sql_command[:50]}...")
                                        await conn.execute(text(sql_command))
                                
                                insert_migration = text("INSERT INTO schema_migrations (migration_name) VALUES (:name) ON CONFLICT DO NOTHING")
                                await conn.execute(insert_migration, {"name": migration_name})
                            
                            logger.info(f"✅ Миграция {migration_name} применена успешно")
                            
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
        
        try:
            await redis_cache.connect()
        except Exception as e:
            logger.warning(f"⚠️ Не удалось подключиться к Redis: {e}. Кеширование будет недоступно.")
    
    yield
    
    try:
        await redis_cache.disconnect()
    except Exception as e:
        logger.error(f"Ошибка при отключении от Redis: {e}")

app = FastAPI(lifespan=lifespan)

class CacheControlMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        path = request.url.path
        
        if path.startswith('/banners') or path.startswith('/market/items') or path.startswith('/market/statix-bonus'):
            response.headers["Cache-Control"] = "public, max-age=300"
        elif path.startswith('/leaderboard'):
            response.headers["Cache-Control"] = "public, max-age=60"
        elif path.startswith('/transactions/feed'):
            response.headers["Cache-Control"] = "public, max-age=30"
        elif request.method == "GET" and not path.startswith('/users/me') and not path.startswith('/admin'):
            response.headers["Cache-Control"] = "public, max-age=60"
        else:
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        
        return response

app.add_middleware(CacheControlMiddleware)

origins = [
    "https://mugle-h-rbot-top-managment-m11i.vercel.app",
    "https://mugle-h-rbot-top-managment.vercel.app",
    "http://localhost:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(transactions.router)
app.include_router(market.router)
app.include_router(admin.router)
app.include_router(banners.router)
app.include_router(roulette.router)
app.include_router(scheduler.router)
app.include_router(telegram.router)
app.include_router(sessions.router)
app.include_router(shared_gifts.router)
app.include_router(cache.router)
app.include_router(app_settings.router)
app.include_router(notifications.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the HR Spasibo API"}
