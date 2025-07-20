# backend/dependencies.py
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
import crud
from database import get_db
from models import User

async def get_current_admin_user(
    telegram_id: str = Header(alias="X-Telegram-Id"),
    db: AsyncSession = Depends(get_db)
) -> User:
    user = await crud.get_user_by_telegram(db, telegram_id=int(telegram_id))
    if not user or not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource",
        )
    return user
