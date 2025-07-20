# backend/routers/admin.py

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
import crud
from dependencies import get_current_admin_user # <-- 1. Импортируем нашу проверку
from models import User # <-- 2. Импортируем модель User

router = APIRouter()

class AddPointsRequest(BaseModel):
    amount: int

@router.post("/admin/add-points")
async def add_points(
    request: AddPointsRequest,
    admin_user: User = Depends(get_current_admin_user), # <-- 3. Используем проверку
    db: AsyncSession = Depends(get_db)
):
    await crud.add_points_to_all_users(db, amount=request.amount)
    return {"detail": f"Successfully added {request.amount} points to all users"}


@router.post("/admin/reset-balances")
async def reset_balances_route(
    admin_user: User = Depends(get_current_admin_user), # <-- 4. Используем проверку
    db: AsyncSession = Depends(get_db)
):
    await crud.reset_balances(db)
    return {"detail": "Balances reset successfully"}
