# backend/routers/admin.py

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
import crud
from dependencies import get_current_admin_user
from models import User
from database import get_db # <-- ВОТ НЕДОСТАЮЩИЙ ИМПОРТ

router = APIRouter()

class AddPointsRequest(BaseModel):
    amount: int

@router.post("/admin/add-points")
async def add_points(
    request: AddPoints_Request,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    await crud.add_points_to_all_users(db, amount=request.amount)
    return {"detail": f"Successfully added {request.amount} points to all users"}


@router.post("/admin/reset-balances")
async def reset_balances_route(
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    await crud.reset_balances(db)
    return {"detail": "Balances reset successfully"}
