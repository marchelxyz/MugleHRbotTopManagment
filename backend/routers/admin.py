# backend/routers/admin.py

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import crud
import schemas
import models
from dependencies import get_current_admin_user
from models import User
from database import get_db
from fastapi import Response

router = APIRouter()

class AddPointsRequest(BaseModel):
    amount: int
class AddTicketsRequest(BaseModel):
    amount: int

@router.post("/admin/add-points")
async def add_points(
    request: AddPointsRequest, # <-- Опечатка исправлена
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    await crud.add_points_to_all_users(db, amount=request.amount)
    return {"detail": f"Successfully added {request.amount} points to all users"}

# --- НАЧАЛО ИЗМЕНЕНИЙ: Добавляем новый эндпоинт ---
@router.post("/admin/add-tickets")
async def add_tickets(
    request: AddTicketsRequest,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    await crud.add_tickets_to_all_users(db, amount=request.amount)
    return {"detail": f"Successfully added {request.amount} tickets to all users"}
# --- КОНЕЦ ИЗМЕНЕНИЙ ---

# backend/routers/admin.py
# ... (импорты)

# --- ИЗМЕНЕНИЕ: Заменяем старую функцию на новую ---
@router.post("/admin/market-items", response_model=schemas.MarketItemResponse)
async def create_new_market_item(
    item: schemas.MarketItemCreate,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    # Используем новую функцию из crud
    new_item = await crud.admin_create_market_item(db=db, item=item)
    # Добавляем в ответ расчетную цену
    return {**new_item.__dict__, "price_spasibki": new_item.price}

# --- НОВЫЙ ЭНДПОИНТ: Для обновления товара ---
@router.put("/admin/market-items/{item_id}", response_model=schemas.MarketItemResponse)
async def update_market_item_route(
    item_id: int,
    item_data: schemas.MarketItemUpdate,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    updated_item = await crud.admin_update_market_item(db, item_id, item_data)
    if not updated_item:
        raise HTTPException(status_code=404, detail="Item not found")
    return {**updated_item.__dict__, "price_spasibki": updated_item.price}

# --- НОВЫЙ ЭНДПОИНТ: Для архивации (удаления) товара ---
@router.delete("/admin/market-items/{item_id}", status_code=204)
async def archive_item_route(
    item_id: int,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    success = await crud.archive_market_item(db, item_id)
    if not success:
        raise HTTPException(status_code=404, detail="Item not found")
    return Response(status_code=204)

# --- НОВЫЙ ЭНДПОИНТ: Для просмотра архива ---
@router.get("/admin/market-items/archived", response_model=list[schemas.MarketItemResponse])
async def get_archived_items_route(
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    items = await crud.get_archived_items(db)
    # Добавляем расчетную цену для каждого элемента
    return [{**item.__dict__, "price_spasibki": item.price} for item in items]

# --- НОВЫЙ ЭНДПОИНТ: Получение всех активных товаров для админки ---
@router.get("/admin/market-items", response_model=List[schemas.MarketItemResponse])
async def get_all_active_items_route(
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    return await crud.get_active_items(db)

@router.post("/admin/reset-balances")
async def reset_balances_route(
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    await crud.reset_balances(db)
    return {"detail": "Balances reset successfully"}

# --- НАЧАЛО: НОВЫЕ ЭНДПОИНТЫ ДЛЯ УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ ---

@router.get("/admin/users", response_model=List[schemas.UserResponse])
async def get_all_users_for_admin_route(
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить всех пользователей для админки."""
    return await crud.get_all_users_for_admin(db)

@router.put("/admin/users/{user_id}", response_model=schemas.UserResponse)
async def admin_update_user_route(
    user_id: int,
    user_data: schemas.AdminUserUpdate,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновить профиль пользователя от имени админа."""
    # Передаем admin_user в CRUD-функцию
    updated_user = await crud.admin_update_user(db, user_id, user_data, admin_user)
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")
    return updated_user

@router.delete("/admin/users/{user_id}", status_code=204)
async def admin_delete_user_route(
    user_id: int,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """'Мягкое' удаление пользователя (сброс до регистрации)."""
    # Передаем admin_user в CRUD-функцию
    success = await crud.admin_delete_user(db, user_id, admin_user)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return Response(status_code=204)

# --- НАЧАЛО: НОВЫЙ ЭНДПОИНТ ДЛЯ СТАТИСТИКИ ---
@router.get("/statistics/general", response_model=schemas.GeneralStatsResponse)
async def get_general_stats_route(
    period: int = Query(7, description="Период в днях (1, 7, 30, 90, 365)"), # Добавили описание
    admin_user: models.User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Возвращает общую статистику по активности в приложении."""
    # --- ИЗМЕНЕНИЕ: Добавляем 1 в список ---
    if period not in [1, 7, 30, 90, 365]:
        raise HTTPException(status_code=400, detail="Недопустимый период. Используйте 1, 7, 30, 90 или 365.")
    
    stats = await crud.get_general_statistics(db, period_days=period)
    return stats
# --- КОНЕЦ: НОВЫЙ ЭНДПОИНТ ДЛЯ СТАТИСТИКИ ---
