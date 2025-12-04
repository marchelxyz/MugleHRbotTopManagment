# backend/app.py

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from starlette.middleware.base import BaseHTTPMiddleware

# Абсолютные импорты (без точек)
from database import engine, Base
from routers import users, transactions, market, admin, banners, roulette, scheduler, telegram, sessions, shared_gifts, auth

# --- ПРАВИЛЬНЫЙ АСИНХРОННЫЙ СПОСОБ СОЗДАНИЯ ТАБЛИЦ И ПРИМЕНЕНИЯ МИГРАЦИЙ ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    from pathlib import Path
    from sqlalchemy import text, select
    import logging
    import sys
    import re
    
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    
    # Настраиваем вывод логов в консоль
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
        logger.addHandler(handler)
    
    # Создаем таблицы на основе моделей (если их еще нет)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Сначала создаем таблицу для отслеживания миграций (если её еще нет)
    migrations_dir = Path(__file__).parent / "migrations"
    if not migrations_dir.exists():
        logger.error(f"❌ Папка migrations не найдена: {migrations_dir}")
        logger.error(f"📂 Текущая директория: {Path(__file__).parent}")
        logger.error(f"📂 Абсолютный путь: {Path(__file__).parent.absolute()}")
    else:
        logger.info(f"✅ Папка migrations найдена: {migrations_dir}")
        
        # Создаем таблицу для отслеживания миграций
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
            async with engine.begin() as conn:
                # Выполняем команды отдельно, так как asyncpg не поддерживает множественные команды в одном prepared statement
                await conn.execute(text(create_table_sql))
                await conn.execute(text(create_index_sql))
                logger.info("✅ Таблица schema_migrations создана/проверена")
        except Exception as e:
            logger.error(f"❌ Ошибка при создании таблицы schema_migrations: {e}")
            raise  # Прерываем запуск, если не можем создать таблицу отслеживания
        
        # Получаем список уже примененных миграций
        async with engine.connect() as conn:
            result = await conn.execute(select(text("migration_name")).select_from(text("schema_migrations")))
            applied_migrations = {row[0] for row in result.fetchall()}
            logger.info(f"📋 Уже применено миграций: {len(applied_migrations)}")
        
        # Применяем миграции из папки migrations
        migration_files = sorted([f for f in migrations_dir.glob("*.sql")])
        
        if not migration_files:
            logger.warning("⚠️ Файлы миграций не найдены")
        else:
            logger.info(f"🔍 Найдено {len(migration_files)} файлов миграций")
            
            for migration_file in migration_files:
                migration_name = migration_file.name
                
                # Пропускаем миграции, которые уже были применены
                if migration_name in applied_migrations:
                    logger.info(f"⏭️  Миграция {migration_name} уже применена, пропускаем")
                    continue
                
                logger.info(f"📄 Применение миграции: {migration_name}")
                
                try:
                    with open(migration_file, 'r', encoding='utf-8') as f:
                        migration_sql = f.read()
                    
                    # Разбиваем SQL на отдельные команды (asyncpg не поддерживает множественные команды в одном prepared statement)
                    def split_sql_commands(sql_text):
                        """Разбивает SQL текст на отдельные команды, удаляя комментарии и учитывая dollar-quoted блоки"""
                        # Удаляем многострочные комментарии /* ... */
                        sql_text = re.sub(r'/\*.*?\*/', '', sql_text, flags=re.DOTALL)
                        
                        # Разбиваем на строки и обрабатываем
                        lines = []
                        for line in sql_text.split('\n'):
                            # Удаляем однострочные комментарии
                            if '--' in line:
                                line = line.split('--')[0]
                            # Убираем пробелы в начале и конце
                            line = line.strip()
                            if line:
                                lines.append(line)
                        
                        # Объединяем строки обратно
                        sql_clean = ' '.join(lines)
                        
                        # Разбиваем по точке с запятой, учитывая dollar-quoted блоки
                        commands = []
                        current_command = []
                        in_dollar_quote = False
                        dollar_tag = None
                        i = 0
                        
                        while i < len(sql_clean):
                            # Проверяем начало dollar-quoted блока
                            if not in_dollar_quote and sql_clean[i] == '$':
                                # Ищем закрывающий $ для определения тега
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
                            
                            # Проверяем конец dollar-quoted блока
                            if in_dollar_quote and sql_clean[i] == '$':
                                # Проверяем, совпадает ли тег
                                if i + len(dollar_tag) <= len(sql_clean):
                                    potential_tag = sql_clean[i:i + len(dollar_tag)]
                                    if potential_tag == dollar_tag:
                                        current_command.append(dollar_tag)
                                        i += len(dollar_tag)
                                        in_dollar_quote = False
                                        dollar_tag = None
                                        continue
                            
                            current_command.append(sql_clean[i])
                            
                            # Разбиваем по точке с запятой только если мы не внутри dollar-quoted блока
                            if not in_dollar_quote and sql_clean[i] == ';':
                                cmd = ''.join(current_command).strip()
                                if cmd:
                                    commands.append(cmd)
                                current_command = []
                            
                            i += 1
                        
                        # Добавляем последнюю команду, если она есть
                        if current_command:
                            cmd = ''.join(current_command).strip()
                            if cmd:
                                commands.append(cmd)
                        
                        return commands
                    
                    # Применяем миграцию в транзакции
                    async with engine.begin() as conn:
                        # Разбиваем SQL на отдельные команды и выполняем каждую отдельно
                        sql_commands = split_sql_commands(migration_sql)
                        
                        for i, sql_command in enumerate(sql_commands, 1):
                            if sql_command.strip():
                                logger.debug(f"  Выполнение команды {i}/{len(sql_commands)}: {sql_command[:50]}...")
                                await conn.execute(text(sql_command))
                        
                        # Записываем факт применения миграции
                        insert_migration = text("INSERT INTO schema_migrations (migration_name) VALUES (:name) ON CONFLICT DO NOTHING")
                        await conn.execute(insert_migration, {"name": migration_name})
                    
                    logger.info(f"✅ Миграция {migration_name} применена успешно")
                    
                except Exception as e:
                    error_msg = f"❌ КРИТИЧЕСКАЯ ОШИБКА при применении миграции {migration_name}: {e}"
                    logger.error(error_msg)
                    logger.exception(e)  # Выводим полный traceback
                    # Прерываем запуск приложения при ошибке миграции
                    raise RuntimeError(error_msg) from e
            
            logger.info("🎉 Применение миграций завершено")
    
    yield

app = FastAPI(lifespan=lifespan)

# Middleware для кеширования API ответов
class CacheControlMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Определяем пути, которые нужно кешировать
        path = request.url.path
        
        # Кешируем статические данные на 5 минут
        if path.startswith('/banners') or path.startswith('/market/items') or path.startswith('/market/statix-bonus'):
            response.headers["Cache-Control"] = "public, max-age=300"
        # Кешируем данные лидерборда на 1 минуту
        elif path.startswith('/leaderboard'):
            response.headers["Cache-Control"] = "public, max-age=60"
        # Кешируем фид транзакций на 30 секунд
        elif path.startswith('/transactions/feed'):
            response.headers["Cache-Control"] = "public, max-age=30"
        # Для остальных GET запросов - короткое кеширование
        elif request.method == "GET" and not path.startswith('/users/me') and not path.startswith('/admin'):
            response.headers["Cache-Control"] = "public, max-age=60"
        # Для POST/PUT/DELETE - не кешируем
        else:
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        
        return response

app.add_middleware(CacheControlMiddleware)

# Настройка CORS
origins = [
    # 1. Адрес твоего рабочего приложения (ПРОДАКШЕН)
    "https://mugle-h-rbot-top-managment-m11i.vercel.app",

    "https://mugle-h-rbot-top-managment.vercel.app",
    
    # 2. Адрес для локальной разработки (РАЗРАБОТКА)
    "http://localhost:8080", # (или 3000, 8000 в зависимости от твоих настроек)
    "http://localhost:5173", # Vite dev server
    "http://localhost:3000", # React dev server
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(auth.router)
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

@app.get("/")
def read_root():
    return {"message": "Welcome to the HR Spasibo API"}
