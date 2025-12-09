# backend/examples_redis_usage.py
"""
Примеры использования Redis кеширования в роутерах
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from redis_client import cache_get, cache_set, cache_delete, CacheKeys
import crud
import schemas

router = APIRouter()


# ============================================
# ПРИМЕР 1: Кеширование Feed транзакций
# ============================================
@router.get("/transactions/feed", response_model=list[schemas.FeedItem])
async def get_feed(db: AsyncSession = Depends(get_db)):
    """
    Получить feed транзакций с кешированием на 30 секунд
    
    БЕЗ Redis: ~150ms на запрос (сложный JOIN)
    С Redis: ~2ms если в кеше, ~150ms если нет (первый запрос)
    """
    cache_key = CacheKeys.FEED_LATEST
    
    # Пытаемся получить из кеша
    cached_data = await cache_get(cache_key)
    if cached_data:
        return cached_data
    
    # Если нет в кеше - получаем из БД
    data = await crud.get_feed(db)
    
    # Сохраняем в кеш на 30 секунд
    await cache_set(cache_key, data, ttl=30)
    
    return data


# ============================================
# ПРИМЕР 2: Кеширование Leaderboard
# ============================================
@router.get("/leaderboard/", response_model=list[schemas.LeaderboardItem])
async def get_leaderboard(
    period: str = 'current_month',
    leaderboard_type: str = 'received',
    db: AsyncSession = Depends(get_db)
):
    """
    Получить leaderboard с кешированием на 1 минуту
    
    БЕЗ Redis: ~200-500ms (агрегация данных)
    С Redis: ~2ms если в кеше
    """
    cache_key = CacheKeys.leaderboard(period, leaderboard_type)
    
    # Пытаемся получить из кеша
    cached_data = await cache_get(cache_key)
    if cached_data:
        return cached_data
    
    # Если нет в кеше - получаем из БД
    data = await crud.get_leaderboard_data(db, period, leaderboard_type)
    
    # Сохраняем в кеш на 60 секунд
    await cache_set(cache_key, data, ttl=60)
    
    return data


# ============================================
# ПРИМЕР 3: Кеширование Market Items
# ============================================
@router.get("/market/items")
async def get_market_items(db: AsyncSession = Depends(get_db)):
    """
    Получить товары маркета с кешированием на 5 минут
    
    БЕЗ Redis: ~50ms на запрос
    С Redis: ~2ms если в кеше
    """
    cache_key = CacheKeys.MARKET_ITEMS
    
    # Пытаемся получить из кеша
    cached_data = await cache_get(cache_key)
    if cached_data:
        return cached_data
    
    # Если нет в кеше - получаем из БД
    data = await crud.get_market_items(db)
    
    # Сохраняем в кеш на 5 минут (300 секунд)
    await cache_set(cache_key, data, ttl=300)
    
    return data


# ============================================
# ПРИМЕР 4: Кеширование данных пользователя
# ============================================
@router.get("/users/me", response_model=schemas.UserResponse)
async def get_self(
    telegram_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Получить данные пользователя с кешированием на 1 минуту
    
    БЕЗ Redis: ~20-50ms на запрос
    С Redis: ~2ms если в кеше
    """
    telegram_id_int = int(telegram_id)
    cache_key = CacheKeys.user_by_telegram(telegram_id_int)
    
    # Пытаемся получить из кеша
    cached_data = await cache_get(cache_key)
    if cached_data:
        return cached_data
    
    # Если нет в кеше - получаем из БД
    user = await crud.get_user_by_telegram(db, telegram_id_int)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Сохраняем в кеш на 60 секунд
    await cache_set(cache_key, user, ttl=60)
    
    return user


# ============================================
# ПРИМЕР 5: Инвалидация кеша при обновлении
# ============================================
@router.post("/points/transfer", response_model=schemas.UserResponse)
async def create_transaction(
    tr: schemas.TransferRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Создать транзакцию и очистить связанные кеши
    
    ВАЖНО: При изменении данных нужно очищать кеш!
    """
    # Создаем транзакцию
    updated_sender = await crud.create_transaction(db=db, tr=tr)
    
    # Очищаем кеши, которые зависят от транзакций
    await cache_delete(CacheKeys.FEED_LATEST)  # Feed изменился
    
    # Очищаем leaderboard для текущего месяца (транзакция влияет на рейтинг)
    await cache_delete(CacheKeys.leaderboard('current_month', 'received'))
    await cache_delete(CacheKeys.leaderboard('current_month', 'sent'))
    
    # Очищаем кеш пользователя (баланс изменился)
    await cache_delete(CacheKeys.user_by_telegram(updated_sender.telegram_id))
    
    return updated_sender


# ============================================
# ПРИМЕР 6: Кеширование Banners
# ============================================
@router.get("/banners")
async def get_banners(db: AsyncSession = Depends(get_db)):
    """
    Получить активные баннеры с кешированием на 5 минут
    
    БЕЗ Redis: ~30ms на запрос
    С Redis: ~2ms если в кеше
    """
    cache_key = CacheKeys.BANNERS_ACTIVE
    
    # Пытаемся получить из кеша
    cached_data = await cache_get(cache_key)
    if cached_data:
        return cached_data
    
    # Если нет в кеше - получаем из БД
    data = await crud.get_active_banners(db)
    
    # Сохраняем в кеш на 5 минут
    await cache_set(cache_key, data, ttl=300)
    
    return data


# ============================================
# ПРИМЕР 7: Обновление баннера с очисткой кеша
# ============================================
@router.put("/admin/banners/{banner_id}")
async def update_banner(
    banner_id: int,
    banner_data: schemas.BannerUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Обновить баннер и очистить кеш
    
    ВАЖНО: При изменении данных очищаем кеш!
    """
    # Обновляем баннер в БД
    updated_banner = await crud.update_banner(db, banner_id, banner_data)
    
    # Очищаем кеш баннеров
    await cache_delete(CacheKeys.BANNERS_ACTIVE)
    
    return updated_banner


# ============================================
# ПРИМЕР 8: Умная инвалидация кеша
# ============================================
@router.post("/market/purchase/")
async def purchase_item(
    purchase_data: schemas.PurchaseRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Покупка товара с умной очисткой кеша
    
    Очищаем только те кеши, которые реально изменились
    """
    # Выполняем покупку
    result = await crud.purchase_item(db, purchase_data)
    
    # Очищаем кеши, которые зависят от покупки
    await cache_delete(CacheKeys.MARKET_ITEMS)  # Может измениться количество
    await cache_delete(CacheKeys.user_by_telegram(purchase_data.user_id))  # Баланс пользователя
    
    # НЕ очищаем feed и leaderboard - покупка не влияет на них напрямую
    
    return result
