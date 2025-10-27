# backend/crud/roulette.py

from typing import List, Optional
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_
import models
import schemas
import random


async def assemble_tickets(db: AsyncSession, user_id: int):
    """Собрать билеты для рулетки"""
    user = await db.get(models.User, user_id)
    if not user:
        return None
    
    if user.ticket_parts >= 3:
        # Собираем билет
        user.ticket_parts -= 3
        user.tickets += 1
        await db.commit()
        await db.refresh(user)
        return {"success": True, "tickets": user.tickets, "ticket_parts": user.ticket_parts}
    
    return {"success": False, "message": "Недостаточно частей билета"}


async def spin_roulette(db: AsyncSession, user_id: int):
    """Крутить рулетку"""
    user = await db.get(models.User, user_id)
    if not user:
        return None
    
    if user.tickets <= 0:
        return {"success": False, "message": "Нет билетов для игры"}
    
    # Определяем приз
    prizes = [
        {"name": "10 спасибок", "amount": 10, "probability": 0.4},
        {"name": "25 спасибок", "amount": 25, "probability": 0.3},
        {"name": "50 спасибок", "amount": 50, "probability": 0.2},
        {"name": "100 спасибок", "amount": 100, "probability": 0.1}
    ]
    
    # Выбираем приз на основе вероятности
    rand = random.random()
    cumulative_probability = 0
    selected_prize = None
    
    for prize in prizes:
        cumulative_probability += prize["probability"]
        if rand <= cumulative_probability:
            selected_prize = prize
            break
    
    if not selected_prize:
        selected_prize = prizes[0]  # Fallback
    
    # Обновляем баланс пользователя
    user.balance += selected_prize["amount"]
    user.tickets -= 1
    
    # Создаем запись о выигрыше
    win_record = models.RouletteWin(
        user_id=user_id,
        prize_name=selected_prize["name"],
        prize_amount=selected_prize["amount"]
    )
    
    db.add(win_record)
    await db.commit()
    await db.refresh(user)
    await db.refresh(win_record)
    
    return {
        "success": True,
        "prize": selected_prize["name"],
        "amount": selected_prize["amount"],
        "balance": user.balance,
        "tickets": user.tickets
    }


async def get_roulette_history(db: AsyncSession, user_id: int, limit: int = 10):
    """Получить историю выигрышей рулетки"""
    result = await db.execute(
        select(models.RouletteWin)
        .where(models.RouletteWin.user_id == user_id)
        .order_by(desc(models.RouletteWin.timestamp))
        .limit(limit)
    )
    return result.scalars().all()


async def reset_ticket_parts(db: AsyncSession):
    """Сбросить части билетов (ежедневная задача)"""
    # Сбрасываем части билетов у всех пользователей
    result = await db.execute(select(models.User))
    users = result.scalars().all()
    
    for user in users:
        user.ticket_parts = 0
    
    await db.commit()
    
    return {"users_updated": len(users)}


async def reset_tickets(db: AsyncSession):
    """Сбросить билеты (ежемесячная задача)"""
    # Сбрасываем билеты у всех пользователей
    result = await db.execute(select(models.User))
    users = result.scalars().all()
    
    for user in users:
        user.tickets = 0
    
    await db.commit()
    
    return {"users_updated": len(users)}
