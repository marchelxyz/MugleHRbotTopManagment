# backend/routers/admin.py

from fastapi import APIRouter, Depends, HTTPException, Response, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import date # <-- Добавляем date
import crud
import schemas
import models
from dependencies import get_current_admin_user
from database import get_db

# --- ПРАВИЛЬНАЯ НАСТРОЙКА РОУТЕРА ---
# Префикс /admin и зависимость от админа задаются один раз здесь
router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(get_current_admin_user)]
)

class AddPointsRequest(BaseModel):
    amount: int
class AddTicketsRequest(BaseModel):
    amount: int

# --- Эндпоинты управления ---

@router.post("/add-points")
async def add_points(request: AddPointsRequest, db: AsyncSession = Depends(get_db)):
    await crud.add_points_to_all_users(db, amount=request.amount)
    return {"detail": f"Successfully added {request.amount} points to all users"}

@router.post("/add-tickets")
async def add_tickets(request: AddTicketsRequest, db: AsyncSession = Depends(get_db)):
    await crud.add_tickets_to_all_users(db, amount=request.amount)
    return {"detail": f"Successfully added {request.amount} tickets to all users"}

@router.post("/market-items", response_model=schemas.MarketItemResponse)
async def create_new_market_item(item: schemas.MarketItemCreate, db: AsyncSession = Depends(get_db)):
    new_item = await crud.admin_create_market_item(db=db, item=item)
    return {**new_item.__dict__, "price_spasibki": new_item.price}

@router.put("/market-items/{item_id}", response_model=schemas.MarketItemResponse)
async def update_market_item_route(item_id: int, item_data: schemas.MarketItemUpdate, db: AsyncSession = Depends(get_db)):
    updated_item = await crud.admin_update_market_item(db, item_id, item_data)
    if not updated_item:
        raise HTTPException(status_code=404, detail="Item not found")
    return {**updated_item.__dict__, "price_spasibki": updated_item.price}

@router.delete("/market-items/{item_id}", status_code=204)
async def archive_item_route(item_id: int, db: AsyncSession = Depends(get_db)):
    success = await crud.archive_market_item(db, item_id)
    if not success:
        raise HTTPException(status_code=404, detail="Item not found")
    return Response(status_code=204)
    
@router.get("/market-items/archived", response_model=list[schemas.MarketItemResponse])
async def get_archived_items_route(db: AsyncSession = Depends(get_db)):
    items = await crud.get_archived_items(db)
    return [{**item.__dict__, "price_spasibki": item.price} for item in items]

@router.get("/market-items", response_model=List[schemas.MarketItemResponse])
async def get_all_active_items_route(db: AsyncSession = Depends(get_db)):
    return await crud.get_active_items(db)

@router.post("/reset-balances")
async def reset_balances_route(db: AsyncSession = Depends(get_db)):
    await crud.reset_balances(db)
    return {"detail": "Balances reset successfully"}

@router.get("/users", response_model=List[schemas.UserResponse])
async def get_all_users_for_admin_route(db: AsyncSession = Depends(get_db)):
    return await crud.get_all_users_for_admin(db)

@router.put("/users/{user_id}", response_model=schemas.UserResponse)
async def admin_update_user_route(user_id: int, user_data: schemas.AdminUserUpdate, admin_user: models.User = Depends(get_current_admin_user), db: AsyncSession = Depends(get_db)):
    updated_user = await crud.admin_update_user(db, user_id, user_data, admin_user)
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")
    return updated_user

@router.delete("/users/{user_id}", status_code=204)
async def admin_delete_user_route(user_id: int, admin_user: models.User = Depends(get_current_admin_user), db: AsyncSession = Depends(get_db)):
    success = await crud.admin_delete_user(db, user_id, admin_user)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return Response(status_code=204)

# --- НОВЫЕ И ИСПРАВЛЕННЫЕ ЭНДПОИНТЫ ДЛЯ СТАТИСТИКИ ---

@router.get("/statistics/general", response_model=schemas.GeneralStatsResponse)
async def get_general_statistics_route(
    start_date: Optional[date] = Query(None), 
    end_date: Optional[date] = Query(None), 
    db: AsyncSession = Depends(get_db)
):
    stats = await crud.get_general_statistics(db=db, start_date=start_date, end_date=end_date)
    return stats

@router.get("/statistics/hourly_activity", response_model=schemas.HourlyActivityStats)
async def get_hourly_activity(
    start_date: Optional[date] = Query(None), 
    end_date: Optional[date] = Query(None), 
    db: AsyncSession = Depends(get_db)
):
    stats = await crud.get_hourly_activity_stats(db, start_date=start_date, end_date=end_date)
    return {"hourly_stats": stats}

@router.get("/statistics/login_activity", response_model=schemas.LoginActivityStats)
async def get_login_activity(
    start_date: Optional[date] = Query(None), 
    end_date: Optional[date] = Query(None), 
    db: AsyncSession = Depends(get_db)
):
    stats = await crud.get_login_activity_stats(db, start_date=start_date, end_date=end_date)
    return {"hourly_stats": stats}

@router.get("/statistics/active_user_ratio", response_model=schemas.ActiveUserRatioStats)
async def get_active_user_ratio_route(db: AsyncSession = Depends(get_db)):
    ratio_data = await crud.get_active_user_ratio(db)
    return ratio_data
