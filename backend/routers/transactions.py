from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Literal
import crud
import schemas
from database import get_db
from dependencies import get_current_user
import models

router = APIRouter()

@router.post("/points/transfer", response_model=schemas.UserResponse)
async def create_new_transaction(tr: schemas.TransferRequest, db: AsyncSession = Depends(get_db)):
    try:
        updated_sender = await crud.create_transaction(db=db, tr=tr)
        return updated_sender
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/transactions/feed", response_model=list[schemas.FeedItem])
async def get_feed(db: AsyncSession = Depends(get_db)):
    return await crud.get_feed(db)

@router.get("/leaderboard/", response_model=list[schemas.LeaderboardItem])
async def get_leaderboard(
    period: Literal['current_month', 'last_month', 'all_time'] = 'current_month',
    type: Literal['received', 'sent'] = 'received',
    db: AsyncSession = Depends(get_db)
):
    return await crud.get_leaderboard_data(db, period=period, leaderboard_type=type)


@router.get("/leaderboard/my-rank", response_model=schemas.MyRankResponse)
async def get_my_rank(
    period: Literal['current_month', 'last_month', 'all_time'] = 'current_month',
    type: Literal['received', 'sent'] = 'received',
    user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await crud.get_user_rank(db, user_id=user.id, period=period, leaderboard_type=type)

@router.get("/leaderboard/status")
async def get_leaderboards_status_route(db: AsyncSession = Depends(get_db)):
    return await crud.get_leaderboards_status(db)
