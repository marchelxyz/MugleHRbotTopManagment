# backend/database.py

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base # 1. Добавляем declarative_base
from config import Settings

# 2. Создаем наш главный "чертёж" (Base) здесь
Base = declarative_base()

settings = Settings()
database_url = settings.DATABASE_URL

if database_url and database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# НАСТРОЙКИ ДЛЯ СТАБИЛЬНОЙ РАБОТЫ В ОБЛАКЕ
# Оптимизация пула соединений для production
import os
pool_size = int(os.getenv("DATABASE_POOL_SIZE", "10"))  # По умолчанию 10 соединений
max_overflow = int(os.getenv("DATABASE_MAX_OVERFLOW", "20"))  # Максимум дополнительных соединений

engine = create_async_engine(
    database_url,
    echo=False,  # Отключаем echo в production для производительности
    future=True,
    pool_pre_ping=True,  # Проверять "живое" ли соединение перед использованием
    pool_recycle=1800,   # Принудительно обновлять соединение каждые 30 минут
    pool_size=pool_size,  # Размер пула соединений
    max_overflow=max_overflow,  # Максимум дополнительных соединений
    pool_timeout=30,  # Таймаут ожидания свободного соединения
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
