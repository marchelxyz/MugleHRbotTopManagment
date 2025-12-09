# backend/redis_client.py
"""
Redis клиент для кеширования данных
"""
import json
import logging
from typing import Optional, Any
from redis.asyncio import Redis
from redis.asyncio.connection import ConnectionPool
from config import Settings

logger = logging.getLogger(__name__)
settings = Settings()

# Глобальный пул соединений Redis
redis_pool: Optional[ConnectionPool] = None
redis_client: Optional[Redis] = None


async def init_redis():
    """Инициализация Redis клиента"""
    global redis_pool, redis_client
    
    try:
        # Получаем URL Redis из настроек или используем дефолтный
        redis_url = getattr(settings, 'REDIS_URL', 'redis://localhost:6379/0')
        
        # Создаем пул соединений
        redis_pool = ConnectionPool.from_url(
            redis_url,
            max_connections=50,
            decode_responses=False  # Получаем bytes для совместимости
        )
        
        redis_client = Redis(connection_pool=redis_pool)
        
        # Проверяем подключение
        await redis_client.ping()
        logger.info("✅ Redis подключен успешно")
        
    except Exception as e:
        logger.warning(f"⚠️ Redis недоступен: {e}. Приложение будет работать без кеширования.")
        redis_client = None


async def close_redis():
    """Закрытие соединения с Redis"""
    global redis_client, redis_pool
    
    if redis_client:
        await redis_client.close()
        redis_client = None
    
    if redis_pool:
        await redis_pool.disconnect()
        redis_pool = None
    
    logger.info("Redis соединение закрыто")


def get_redis() -> Optional[Redis]:
    """Получить Redis клиент"""
    return redis_client


async def cache_get(key: str) -> Optional[Any]:
    """
    Получить значение из кеша
    
    Args:
        key: Ключ кеша
        
    Returns:
        Распарсенное значение или None если не найдено
    """
    if not redis_client:
        return None
    
    try:
        data = await redis_client.get(key)
        if data:
            # Декодируем bytes в строку и парсим JSON
            if isinstance(data, bytes):
                data = data.decode('utf-8')
            return json.loads(data)
    except Exception as e:
        logger.error(f"Ошибка при получении из кеша {key}: {e}")
    
    return None


async def cache_set(key: str, value: Any, ttl: int = 300):
    """
    Сохранить значение в кеш
    
    Args:
        key: Ключ кеша
        value: Значение для сохранения (будет сериализовано в JSON)
        ttl: Время жизни в секундах (по умолчанию 5 минут)
    """
    if not redis_client:
        return
    
    try:
        json_data = json.dumps(value, default=str)  # default=str для datetime
        await redis_client.setex(key, ttl, json_data.encode('utf-8'))
    except Exception as e:
        logger.error(f"Ошибка при сохранении в кеш {key}: {e}")


async def cache_delete(key: str):
    """
    Удалить значение из кеша
    
    Args:
        key: Ключ кеша
    """
    if not redis_client:
        return
    
    try:
        await redis_client.delete(key)
    except Exception as e:
        logger.error(f"Ошибка при удалении из кеша {key}: {e}")


async def cache_delete_pattern(pattern: str):
    """
    Удалить все ключи по паттерну
    
    Args:
        pattern: Паттерн для поиска ключей (например, "feed:*")
    """
    if not redis_client:
        return
    
    try:
        # Используем SCAN для безопасного поиска ключей
        cursor = 0
        deleted = 0
        
        while True:
            cursor, keys = await redis_client.scan(cursor, match=pattern, count=100)
            if keys:
                await redis_client.delete(*keys)
                deleted += len(keys)
            
            if cursor == 0:
                break
        
        logger.info(f"Удалено {deleted} ключей по паттерну {pattern}")
    except Exception as e:
        logger.error(f"Ошибка при удалении по паттерну {pattern}: {e}")


async def cache_exists(key: str) -> bool:
    """
    Проверить существование ключа в кеше
    
    Args:
        key: Ключ кеша
        
    Returns:
        True если ключ существует, False иначе
    """
    if not redis_client:
        return False
    
    try:
        return await redis_client.exists(key) > 0
    except Exception as e:
        logger.error(f"Ошибка при проверке существования ключа {key}: {e}")
        return False


# Утилиты для создания ключей кеша
class CacheKeys:
    """Класс с константами для ключей кеша"""
    
    # Feed
    FEED_LATEST = "feed:latest"
    
    # Leaderboard
    @staticmethod
    def leaderboard(period: str, leaderboard_type: str) -> str:
        return f"leaderboard:{period}:{leaderboard_type}"
    
    # Market
    MARKET_ITEMS = "market:items"
    MARKET_STATIX_BONUS = "market:statix-bonus"
    
    # Banners
    BANNERS_ACTIVE = "banners:active"
    
    # Users
    @staticmethod
    def user(telegram_id: int) -> str:
        return f"user:{telegram_id}"
    
    @staticmethod
    def user_by_telegram(telegram_id: int) -> str:
        return f"user:telegram:{telegram_id}"
