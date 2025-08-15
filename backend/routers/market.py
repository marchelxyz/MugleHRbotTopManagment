# backend/routers/market.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import crud
import schemas
from database import get_db

router = APIRouter()

# --- НАЧАЛО ГЛАВНОГО ИСПРАВЛЕНИЯ ---
# Мы убираем `response_model` из декоратора.
# Теперь FastAPI просто возьмет "плоский" список из crud.py и отправит его
# как есть, не пытаясь анализировать модели SQLAlchemy и не попадая в цикл.
@router.get("/market/items")
async def list_items(db: AsyncSession = Depends(get_db)):
    return await crud.get_market_items(db)


@router.post("/market/purchase", response_model=schemas.PurchaseResponse) # <-- 1. Используем новую схему ответа
async def purchase_item(
    request: schemas.PurchaseRequest, db: AsyncSession = Depends(get_db)
):
    try:
        # 2. Получаем новый баланс из crud
        new_balance = await crud.create_purchase(db, request)
        # 3. Формируем правильный ответ
        return {"message": "Purchase successful", "new_balance": new_balance}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
