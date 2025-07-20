# backend/routers/market.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
import crud
import schemas
from database import get_db

router = APIRouter()

@router.get("/market/items", response_model=list[schemas.MarketItemResponse])
async def list_items(db: AsyncSession = Depends(get_db)):
    return await crud.get_market_items(db)


# --- УЛУЧШЕННАЯ ЛОГИКА ПОКУПКИ ---
@router.post("/market/purchase", response_model=schemas.MarketItemResponse)
async def purchase_item(
    request: schemas.PurchaseRequest, db: AsyncSession = Depends(get_db)
):
    try:
        # Пытаемся совершить покупку
        purchased_item = await crud.create_purchase(db, request)
        return purchased_item
    except ValueError as e:
        # Если crud.py выдает ошибку (например, "Insufficient balance"),
        # мы "ловим" ее и отправляем красивый ответ с кодом 400.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e) # Отправляем текст ошибки на фронтенд
        )
# --- КОНЕЦ УЛУЧШЕНИЙ ---
