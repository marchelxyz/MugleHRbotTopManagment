# backend/database.py

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from config import Settings

settings = Settings()
database_url = settings.DATABASE_URL

if database_url and database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# НАСТРОЙКИ ДЛЯ СТАБИЛЬНОЙ РАБОТЫ В ОБЛАКЕ
engine = create_async_engine(
    database_url,
    echo=True,
    future=True,
    pool_pre_ping=True,  # Проверять "живое" ли соединение перед использованием
    pool_recycle=1800,   # Принудительно обновлять соединение каждые 30 минут
)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
