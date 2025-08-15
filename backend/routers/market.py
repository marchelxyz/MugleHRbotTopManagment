# backend/routers/market.py
# backend/routers/market.py

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import crud
import schemas
from database import get_db

router = APIRouter()

# Мы убираем `response_model` из декоратора.
# Это заставит FastAPI просто отправить те "плоские" данные,
# которые мы подготовили в crud.py, не пытаясь запустить сложную обработку.
@router.get("/market/items")
async def list_items(db: AsyncSession = Depends(get_db)):
    return await crud.get_market_items(db)


@router.post("/market/purchase", response_model=schemas.PurchaseResponse)
async def purchase_item(
    request: schemas.PurchaseRequest, db: AsyncSession = Depends(get_db)
):
    # Эта функция остается без изменений
    try:
        new_balance = await crud.create_purchase(db, request)
        return {"message": "Purchase successful", "new_balance": new_balance}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
