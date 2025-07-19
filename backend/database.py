from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from config import Settings

# Загружаем настройки
settings = Settings()

# Получаем оригинальный URL из настроек
database_url = settings.DATABASE_URL

# ИЗМЕНЕНИЕ: Проверяем, начинается ли URL с "postgresql://"
# и заменяем его на "postgresql+asyncpg://", чтобы SQLAlchemy был доволен.
if database_url and database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Асинхронный движок SQLAlchemy
engine = create_async_engine(
    database_url, # Используем наш исправленный URL
    echo=True,
    future=True
)

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
