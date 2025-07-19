# backend/routers/users.py

# ИСПРАВЛЕНИЕ: Убедимся, что Header импортирован
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
import crud
import schemas
from database import get_db

router = APIRouter()

@router.post("/auth/register", response_model=schemas.UserResponse)
async def register_user(request: schemas.RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await crud.get_user_by_telegram(db, request.telegram_id)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already registered")
    return await crud.create_user(db, request)

@router.get("/users", response_model=list[schemas.UserResponse])
async def list_users(db: AsyncSession = Depends(get_db)):
    return await crud.get_users(db)

@router.get("/users/me", response_model=schemas.UserResponse)
async def get_self(telegram_id: str = Header(alias="X-Telegram-Id"), db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_telegram(db, telegram_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user
