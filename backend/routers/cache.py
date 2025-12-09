# backend/routers/cache.py

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, Any
from pydantic import BaseModel
from dependencies import get_current_user
import models
from redis_cache import redis_cache
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/cache",
    tags=["cache"],
    dependencies=[Depends(get_current_user)]
)

class CacheGetResponse(BaseModel):
    key: str
    value: Optional[Any] = None
    exists: bool

class CacheSetRequest(BaseModel):
    key: str
    value: Any
    ttl: Optional[int] = None

class CacheDeleteRequest(BaseModel):
    key: str

@router.get("/{key}", response_model=CacheGetResponse)
async def get_cache(
    key: str,
    current_user: models.User = Depends(get_current_user)
):
    """
    Получает значение из кеша для текущего пользователя.
    
    Поддерживаемые ключи: feed, market, leaderboard, banners, history
    """
    if not current_user.telegram_id or current_user.telegram_id < 0:
        raise HTTPException(status_code=400, detail="Telegram ID не доступен")
    
    try:
        value = await redis_cache.get(current_user.telegram_id, key)
        exists = await redis_cache.exists(current_user.telegram_id, key)
        
        return CacheGetResponse(
            key=key,
            value=value,
            exists=exists
        )
    except Exception as e:
        logger.error(f"Ошибка при получении кеша {key} для пользователя {current_user.telegram_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при получении кеша: {str(e)}")

@router.post("/{key}", status_code=200)
async def set_cache(
    key: str,
    request: CacheSetRequest,
    current_user: models.User = Depends(get_current_user)
):
    """
    Устанавливает значение в кеш для текущего пользователя.
    
    Поддерживаемые ключи: feed, market, leaderboard, banners, history
    """
    if not current_user.telegram_id or current_user.telegram_id < 0:
        raise HTTPException(status_code=400, detail="Telegram ID не доступен")
    
    try:
        await redis_cache.set(
            current_user.telegram_id,
            key,
            request.value,
            request.ttl
        )
        return {"message": f"Кеш {key} успешно установлен"}
    except Exception as e:
        logger.error(f"Ошибка при установке кеша {key} для пользователя {current_user.telegram_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при установке кеша: {str(e)}")

@router.delete("/{key}", status_code=200)
async def delete_cache(
    key: str,
    current_user: models.User = Depends(get_current_user)
):
    """
    Удаляет значение из кеша для текущего пользователя.
    
    Поддерживаемые ключи: feed, market, leaderboard, banners, history
    """
    if not current_user.telegram_id or current_user.telegram_id < 0:
        raise HTTPException(status_code=400, detail="Telegram ID не доступен")
    
    try:
        await redis_cache.delete(current_user.telegram_id, key)
        return {"message": f"Кеш {key} успешно удален"}
    except Exception as e:
        logger.error(f"Ошибка при удалении кеша {key} для пользователя {current_user.telegram_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при удалении кеша: {str(e)}")

@router.delete("/", status_code=200)
async def clear_all_cache(
    current_user: models.User = Depends(get_current_user)
):
    """
    Очищает весь кеш для текущего пользователя.
    """
    if not current_user.telegram_id or current_user.telegram_id < 0:
        raise HTTPException(status_code=400, detail="Telegram ID не доступен")
    
    try:
        await redis_cache.clear_user_cache(current_user.telegram_id)
        return {"message": "Весь кеш пользователя успешно очищен"}
    except Exception as e:
        logger.error(f"Ошибка при очистке кеша для пользователя {current_user.telegram_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при очистке кеша: {str(e)}")
