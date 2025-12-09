# backend/dependencies.py
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import crud
from database import get_db
from models import User
from utils.security import decode_access_token

security = HTTPBearer(auto_error=False)

# --- НАЧАЛО ИЗМЕНЕНИЙ: Добавляем поддержку обоих типов аутентификации ---
async def get_current_user(
    telegram_id: Optional[str] = Header(alias="X-Telegram-Id", default=None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Получает текущего пользователя по Telegram ID или JWT токену.
    Поддерживает оба способа аутентификации:
    1. Telegram (через заголовок X-Telegram-Id)
    2. Browser (через JWT токен в заголовке Authorization)
    """
    # Способ 1: Аутентификация через Telegram
    if telegram_id:
        user = await crud.get_user_by_telegram(db, telegram_id=int(telegram_id))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        return user
    
    # Способ 2: Аутентификация через JWT токен (браузер)
    if credentials:
        token = credentials.credentials
        payload = decode_access_token(token)
        
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        
        user = await crud.get_user(db, int(user_id))
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        return user
    
    # Если ни один способ не предоставлен
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required"
    )
# --- КОНЕЦ ИЗМЕНЕНИЙ ---

async def get_current_admin_user(
    user: User = Depends(get_current_user)
) -> User:
    """Проверяет, что текущий пользователь является администратором."""
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource",
        )
    return user
