# backend/routers/users.py
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
import crud, schemas
from database import get_db

router = APIRouter()

@router.post("/auth/register", response_model=schemas.UserResponse)
async def register_user(request: schemas.RegisterRequest, db: AsyncSession = Depends(get_db)):
    # ИЗМЕНЕНИЕ: Преобразуем ID в число перед поиском
    existing = await crud.get_user_by_telegram(db, int(request.telegram_id))
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already registered")
    return await crud.create_user(db, request)

@router.get("/users", response_model=list[schemas.UserResponse])
async def list_users(db: AsyncSession = Depends(get_db)):
    return await crud.get_users(db)

@router.get("/users/me", response_model=schemas.UserResponse)
async def get_self(telegram_id: str = Header(alias="X-Telegram-Id"), db: AsyncSession = Depends(get_db)):
    # ИЗМЕНЕНИЕ: Преобразуем ID в число перед поиском
    user = await crud.get_user_by_telegram(db, int(telegram_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

@router.get("/{user_id}/transactions", response_model=list[schemas.FeedItem])
async def get_user_transactions_route(user_id: int, db: AsyncSession = Depends(get_db)):
    return await crud.get_user_transactions(db, user_id=user_id)
