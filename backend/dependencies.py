from fastapi import Depends, HTTPException, status, Header
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
import crud
from database import get_db
from models import User

async def get_current_user(
    telegram_id: Optional[str] = Header(alias="X-Telegram-Id", default=None),
    header_user_id: Optional[str] = Header(alias="X-User-Id", default=None),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Получает текущего пользователя по Telegram ID или User ID из заголовка."""
    user = None
    
    if telegram_id:
        try:
            user = await crud.get_user_by_telegram(db, telegram_id=int(telegram_id))
        except (ValueError, TypeError):
            pass
    
    if not user and header_user_id:
        try:
            user = await crud.get_user(db, user_id=int(header_user_id))
        except (ValueError, TypeError):
            pass
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated",
        )
    
    return user

async def get_current_admin_user(
    telegram_id: Optional[str] = Header(alias="X-Telegram-Id", default=None),
    header_user_id: Optional[str] = Header(alias="X-User-Id", default=None),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Получает текущего администратора по Telegram ID или User ID из заголовка."""
    user = None
    
    if telegram_id:
        try:
            user = await crud.get_user_by_telegram(db, telegram_id=int(telegram_id))
        except (ValueError, TypeError):
            pass
    
    if not user and header_user_id:
        try:
            user = await crud.get_user(db, user_id=int(header_user_id))
        except (ValueError, TypeError):
            pass
    
    if not user or not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource",
        )
    return user
