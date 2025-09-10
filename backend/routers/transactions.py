# backend/routers/transactions.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
import crud
import schemas
from database import get_db

router = APIRouter()

@router.post("/points/transfer", response_model=schemas.FeedItem)
async def transfer_points(request: schemas.TransferRequest, db: AsyncSession = Depends(get_db)):
    try:
        # --- ИЗМЕНЕНИЕ: Убираем старые проверки отсюда ---
        # Всю логику проверок теперь выполняет crud.create_transaction
        
        transaction = await crud.create_transaction(db, request)
        return transaction
        
    except ValueError as e:
        # --- ИЗМЕНЕНИЕ: Ловим ошибки бизнес-логики из crud и превращаем в ответ сервера ---
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/transactions/feed", response_model=list[schemas.FeedItem])
async def get_feed(db: AsyncSession = Depends(get_db)):
    return await crud.get_feed(db)

@router.get("/leaderboard/last-month", response_model=list[schemas.LeaderboardItem])
async def get_leaderboard(db: AsyncSession = Depends(get_db)):
    return await crud.get_leaderboard(db)
