# backend/crud/sessions.py

from typing import Optional
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_
import models
import schemas


async def start_user_session(db: AsyncSession, user_id: int):
    """Начать сессию пользователя"""
    # Проверяем, есть ли активная сессия
    existing_session = await db.execute(
        select(models.UserSession)
        .where(
            and_(
                models.UserSession.user_id == user_id,
                models.UserSession.end_time.is_(None)
            )
        )
    )
    existing_session = existing_session.scalars().first()
    
    if existing_session:
        # Обновляем время последнего пинга
        existing_session.last_ping = datetime.now()
        await db.commit()
        await db.refresh(existing_session)
        return existing_session
    
    # Создаем новую сессию
    new_session = models.UserSession(
        user_id=user_id,
        start_time=datetime.now(),
        last_ping=datetime.now()
    )
    
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    
    return new_session


async def ping_user_session(db: AsyncSession, user_id: int):
    """Обновить время последнего пинга сессии"""
    # Находим активную сессию
    session = await db.execute(
        select(models.UserSession)
        .where(
            and_(
                models.UserSession.user_id == user_id,
                models.UserSession.end_time.is_(None)
            )
        )
    )
    session = session.scalars().first()
    
    if session:
        session.last_ping = datetime.now()
        await db.commit()
        await db.refresh(session)
        return session
    
    return None
