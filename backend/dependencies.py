from typing import Optional

from fastapi import Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

import crud
from admin_panel_auth import parse_session_token, synthetic_panel_admin_user
from database import get_db
from models import User


def _parse_bearer_authorization(authorization: Optional[str]) -> Optional[str]:
    """Возвращает сырое значение токена из заголовка ``Authorization: Bearer …``."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:].strip()
    return token or None


async def get_current_admin_panel_bearer_email(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> str:
    """Зависимость: валидный Bearer сессии панели → нормализованный email."""
    raw = _parse_bearer_authorization(authorization)
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется Bearer-токен админ-панели",
        )
    email = parse_session_token(raw)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный или просроченный токен",
        )
    return email


async def _resolve_user_from_headers(
    telegram_id: Optional[str],
    header_user_id: Optional[str],
    db: AsyncSession,
) -> Optional[User]:
    """Резолвит пользователя по X-Telegram-Id или X-User-Id."""
    if telegram_id:
        try:
            return await crud.get_user_by_telegram(db, telegram_id=int(telegram_id))
        except (ValueError, TypeError):
            pass
    if header_user_id:
        try:
            return await crud.get_user(db, user_id=int(header_user_id))
        except (ValueError, TypeError):
            pass
    return None


async def get_current_user(
    telegram_id: Optional[str] = Header(alias="X-Telegram-Id", default=None),
    header_user_id: Optional[str] = Header(alias="X-User-Id", default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Получает текущего пользователя по Telegram ID или User ID из заголовка."""
    user = await _resolve_user_from_headers(telegram_id, header_user_id, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated",
        )
    return user


async def get_current_admin_user(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
    telegram_id: Optional[str] = Header(alias="X-Telegram-Id", default=None),
    header_user_id: Optional[str] = Header(alias="X-User-Id", default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Администратор: Bearer сессии панели (env) или пользователь БД с ``is_admin``.

    Порядок: сначала Bearer, затем заголовки Telegram / X-User-Id.
    """
    bearer = _parse_bearer_authorization(authorization)
    if bearer:
        email = parse_session_token(bearer)
        if email:
            return synthetic_panel_admin_user(email)
    user = await _resolve_user_from_headers(telegram_id, header_user_id, db)
    if not user or not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource",
        )
    return user
