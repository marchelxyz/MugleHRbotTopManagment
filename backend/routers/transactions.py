python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
import crud
import schemas
from database import get_db

router = APIRouter()

@router.post("/points/transfer", response_model=schemas.FeedItem)
async def transfer_points(request: schemas.TransferRequest, db: AsyncSession = Depends(get_db)):
    sender = await crud.get_user(db, request.sender_id)
    receiver = await crud.get_user(db, request.receiver_id)
    if not sender or not receiver:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if sender.balance < request.amount:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient balance")
    return await crud.create_transaction(db, request)

@router.get("/transactions/feed", response_model=list[schemas.FeedItem])
async def get_feed(db: AsyncSession = Depends(get_db)):
    return await crud.get_feed(db)

@router.get("/leaderboard/last-month", response_model=list[schemas.LeaderboardItem])
async def get_leaderboard(db: AsyncSession = Depends(get_db)):
    return await crud.get_leaderboard(db)
