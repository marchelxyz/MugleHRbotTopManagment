import json
import logging
from typing import Optional, Any
import redis.asyncio as aioredis
from config import settings

logger = logging.getLogger(__name__)

class RedisCache:
    """Класс для работы с Redis кешем."""
    
    def __init__(self):
        self.redis_client: Optional[aioredis.Redis] = None
        self._connection_pool: Optional[aioredis.ConnectionPool] = None
    
    async def connect(self):
        """Подключается к Redis."""
        try:
            if settings.REDIS_URL:
                self._connection_pool = aioredis.ConnectionPool.from_url(
                    settings.REDIS_URL,
                    decode_responses=True
                )
            else:
                self._connection_pool = aioredis.ConnectionPool(
                    host=settings.REDIS_HOST,
                    port=settings.REDIS_PORT,
                    db=settings.REDIS_DB,
                    password=settings.REDIS_PASSWORD if settings.REDIS_PASSWORD else None,
                    decode_responses=True
                )
            
            self.redis_client = aioredis.Redis(connection_pool=self._connection_pool)
            
            await self.redis_client.ping()
            logger.info("✅ Redis подключен успешно")
        except Exception as e:
            logger.error(f"❌ Ошибка подключения к Redis: {e}")
            raise
    
    async def disconnect(self):
        """Отключается от Redis."""
        if self.redis_client:
            await self.redis_client.close()
        if self._connection_pool:
            await self._connection_pool.disconnect()
        logger.info("Redis отключен")
    
    def _get_key(self, user_id: int, key: str) -> str:
        """Формирует ключ для Redis с учетом user_id."""
        return f"cache:{user_id}:{key}"
    
    async def get(self, user_id: int, key: str) -> Optional[Any]:
        """
        Получает значение из кеша.
        
        Args:
            user_id: ID пользователя Telegram
            key: Ключ кеша (feed, market, leaderboard, banners, history)
        
        Returns:
            Распарсенное значение или None
        """
        if not self.redis_client:
            await self.connect()
        
        try:
            redis_key = self._get_key(user_id, key)
            value = await self.redis_client.get(redis_key)
            
            if value is None:
                return None
            
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
        except Exception as e:
            logger.error(f"Ошибка при получении из кеша {key} для пользователя {user_id}: {e}")
            return None
    
    async def set(self, user_id: int, key: str, value: Any, ttl: Optional[int] = None):
        """
        Устанавливает значение в кеш.
        
        Args:
            user_id: ID пользователя Telegram
            key: Ключ кеша
            value: Значение для сохранения
            ttl: Время жизни в секундах (по умолчанию 1 час для feed/market, 5 минут для leaderboard)
        """
        if not self.redis_client:
            await self.connect()
        
        try:
            redis_key = self._get_key(user_id, key)
            
            if ttl is None:
                if key in ['feed', 'market', 'banners']:
                    ttl = 3600
                elif key == 'leaderboard':
                    ttl = 300
                elif key == 'history':
                    ttl = 1800
                else:
                    ttl = 3600
            
            if isinstance(value, (dict, list)):
                serialized_value = json.dumps(value, ensure_ascii=False)
            else:
                serialized_value = str(value)
            
            await self.redis_client.setex(redis_key, ttl, serialized_value)
            logger.debug(f"Кеш установлен: {redis_key} (TTL: {ttl}s)")
        except Exception as e:
            logger.error(f"Ошибка при установке кеша {key} для пользователя {user_id}: {e}")
            raise
    
    async def delete(self, user_id: int, key: str):
        """
        Удаляет значение из кеша.
        
        Args:
            user_id: ID пользователя Telegram
            key: Ключ кеша
        """
        if not self.redis_client:
            await self.connect()
        
        try:
            redis_key = self._get_key(user_id, key)
            await self.redis_client.delete(redis_key)
            logger.debug(f"Кеш удален: {redis_key}")
        except Exception as e:
            logger.error(f"Ошибка при удалении кеша {key} для пользователя {user_id}: {e}")
    
    async def clear_user_cache(self, user_id: int):
        """
        Очищает весь кеш пользователя.
        
        Args:
            user_id: ID пользователя Telegram
        """
        if not self.redis_client:
            await self.connect()
        
        try:
            pattern = self._get_key(user_id, "*")
            keys = await self.redis_client.keys(pattern)
            if keys:
                await self.redis_client.delete(*keys)
                logger.info(f"Очищен кеш для пользователя {user_id}: {len(keys)} ключей")
        except Exception as e:
            logger.error(f"Ошибка при очистке кеша пользователя {user_id}: {e}")
    
    async def exists(self, user_id: int, key: str) -> bool:
        """
        Проверяет существование ключа в кеше.
        
        Args:
            user_id: ID пользователя Telegram
            key: Ключ кеша
        
        Returns:
            True если ключ существует, False иначе
        """
        if not self.redis_client:
            await self.connect()
        
        try:
            redis_key = self._get_key(user_id, key)
            return await self.redis_client.exists(redis_key) > 0
        except Exception as e:
            logger.error(f"Ошибка при проверке существования кеша {key} для пользователя {user_id}: {e}")
            return False

redis_cache = RedisCache()
