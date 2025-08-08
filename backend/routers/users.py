# backend/routers/users.py
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
import crud
import schemas
from database import get_db

router = APIRouter()

@router.post("/auth/register", response_model=schemas.UserResponse)
async def register_user(request: schemas.RegisterRequest, db: AsyncSession = Depends(get_db)):
    # В Pydantic v2 .dict() устарел, используем .model_dump()
    # Но так как мы передаем объект целиком, можно и без этого
    # Преобразуем ID в число перед поиском
    existing = await crud.get_user_by_telegram(db, int(request.telegram_id))
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already registered")
    return await crud.create_user(db, request)

@router.get("/users", response_model=list[schemas.UserResponse])
async def list_users(db: AsyncSession = Depends(get_db)):
    return await crud.get_users(db)

@router.get("/users/me", response_model=schemas.UserResponse)
async def get_self(telegram_id: str = Header(alias="X-Telegram-Id"), db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_telegram(db, int(telegram_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # --- ИЗМЕНЕНИЕ: УБИРАЕМ photo_url ---
    # Мы больше не храним фото в базе, поэтому и не возвращаем его.
    # Фронтенд берет фото напрямую из данных Telegram.
    user_response = {
        "id": user.id,
        "telegram_id": user.telegram_id,
        "position": user.position,
        "last_name": user.last_name,
        "department": user.department,
        "balance": user.balance,
        "is_admin": user.is_admin,
        "username": user.username,
        "phone_number": user.phone_number,
        "date_of_birth": str(user.date_of_birth) if user.date_of_birth else None,
        "photo_url": None, # Возвращаем null, чтобы соответствовать схеме
    }
    return user_response
# --- КОНЕЦ ИЗМЕНЕНИЙ ---

@router.put("/users/me", response_model=schemas.UserResponse)
async def update_me(
    user_data: schemas.UserUpdate,
    telegram_id: str = Header(alias="X-Telegram-Id"),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram(db, telegram_id=int(telegram_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    return await crud.update_user_profile(db, user_id=user.id, data=user_data)

@router.get("/{user_id}/transactions", response_model=list[schemas.FeedItem])
async def get_user_transactions_route(user_id: int, db: AsyncSession = Depends(get_db)):
    return await crud.get_user_transactions(db, user_id=user_id)
