# backend/database.py

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from config import Settings

# Загружаем настройки
settings = Settings()

# Получаем оригинальный URL из настроек
database_url = settings.DATABASE_URL

# Проверяем и заменяем URL для asyncpg
if database_url and database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# --- НАЧАЛО ИЗМЕНЕНИЙ ---
# Асинхронный движок SQLAlchemy с настройками пула соединений
engine = create_async_engine(
    database_url,
    echo=True,
    future=True,
    pool_pre_ping=True,  # Проверять соединение перед использованием
    pool_recycle=1800,   # Пересоздавать соединение каждые 30 минут (1800 секунд)
)
# --- КОНЕЦ ИЗМЕНЕНИЙ ---

# Фабрика сессий
AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Депенденси для FastAPI
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
