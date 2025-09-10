# backend/routers/market.py

# 1. Добавляем импорт для response_model
from fastapi import APIRouter, Depends, HTTPException, status # <-- Добавляем HTTPException и status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List 
import crud
import schemas
from database import get_db

router = APIRouter()

# 2. Указываем response_model и возвращаем список по схеме MarketItemResponse
@router.get("/market/items", response_model=List[schemas.MarketItemResponse])
async def list_items(db: AsyncSession = Depends(get_db)):
    # --- ИЗМЕНЕНИЕ: Получаем только активные товары ---
    return await crud.get_active_items(db)


@router.post("/market/purchase", response_model=schemas.PurchaseResponse)
async def purchase_item(
    request: schemas.PurchaseRequest, db: AsyncSession = Depends(get_db)
):
    try:
        new_balance = await crud.create_purchase(db, request)
        return {"message": "Purchase successful", "new_balance": new_balance}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
