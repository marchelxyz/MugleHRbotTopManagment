# backend/routers/cache.py
"""
API для работы с кешем через Redis
Заменяет Telegram CloudStorage на серверный кеш
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from redis_client import cache_get, cache_set, cache_delete, CacheKeys
from database import get_db
from dependencies import get_current_user
import models

router = APIRouter(
    prefix="/cache",
    tags=["cache"],
)


def get_user_cache_key(telegram_id: int, key: str) -> str:
    """Создает ключ кеша для конкретного пользователя"""
    return f"user_cache:{telegram_id}:{key}"


@router.get("/{key}")
async def get_cache(
    key: str,
    telegram_id: str = Header(alias="X-Telegram-Id"),
    db: AsyncSession = Depends(get_db)
):
    """
    Получить значение из кеша для пользователя
    
    Заменяет Telegram CloudStorage.getItem()
    """
    telegram_id_int = int(telegram_id)
    cache_key = get_user_cache_key(telegram_id_int, key)
    
    data = await cache_get(cache_key)
    if data is None:
        raise HTTPException(status_code=404, detail="Cache key not found")
    
    return {"key": key, "value": data}


@router.put("/{key}")
async def set_cache(
    key: str,
    value: dict,
    telegram_id: str = Header(alias="X-Telegram-Id"),
    db: AsyncSession = Depends(get_db)
):
    """
    Сохранить значение в кеш для пользователя
    
    Заменяет Telegram CloudStorage.setItem()
    
    TTL зависит от типа данных:
    - feed: 30 секунд
    - market: 300 секунд (5 минут)
    - leaderboard: 60 секунд
    - banners: 300 секунд (5 минут)
    - history: 300 секунд (5 минут)
    - другие: 60 секунд
    """
    telegram_id_int = int(telegram_id)
    cache_key = get_user_cache_key(telegram_id_int, key)
    
    # Определяем TTL в зависимости от типа данных
    ttl_map = {
        'feed': 30,
        'market': 300,
        'leaderboard': 60,
        'banners': 300,
        'history': 300,
    }
    ttl = ttl_map.get(key, 60)  # По умолчанию 60 секунд
    
    await cache_set(cache_key, value, ttl=ttl)
    
    return {"key": key, "status": "saved", "ttl": ttl}


@router.delete("/{key}")
async def delete_cache(
    key: str,
    telegram_id: str = Header(alias="X-Telegram-Id"),
    db: AsyncSession = Depends(get_db)
):
    """
    Удалить значение из кеша для пользователя
    
    Заменяет удаление из Telegram CloudStorage
    """
    telegram_id_int = int(telegram_id)
    cache_key = get_user_cache_key(telegram_id_int, key)
    
    await cache_delete(cache_key)
    
    return {"key": key, "status": "deleted"}


@router.get("/")
async def get_all_cache(
    telegram_id: str = Header(alias="X-Telegram-Id"),
    db: AsyncSession = Depends(get_db)
):
    """
    Получить все ключи кеша для пользователя (для отладки)
    """
    telegram_id_int = int(telegram_id)
    
    # Получаем все ключи пользователя
    # В реальности лучше использовать SCAN, но для простоты возвращаем список известных ключей
    keys = ['feed', 'market', 'leaderboard', 'banners', 'history']
    result = {}
    
    for key in keys:
        cache_key = get_user_cache_key(telegram_id_int, key)
        data = await cache_get(cache_key)
        if data is not None:
            result[key] = True
    
    return {"keys": result}


@router.delete("/")
async def clear_all_cache(
    telegram_id: str = Header(alias="X-Telegram-Id"),
    db: AsyncSession = Depends(get_db)
):
    """
    Очистить весь кеш пользователя
    """
    telegram_id_int = int(telegram_id)
    keys = ['feed', 'market', 'leaderboard', 'banners', 'history']
    
    deleted = 0
    for key in keys:
        cache_key = get_user_cache_key(telegram_id_int, key)
        if await cache_get(cache_key) is not None:
            await cache_delete(cache_key)
            deleted += 1
    
    return {"status": "cleared", "deleted_keys": deleted}
