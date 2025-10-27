# backend/crud/statix_bonus.py

from typing import List, Optional
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_
import models
import schemas
from config import settings
from bot import send_telegram_message


async def get_statix_bonus_item(db: AsyncSession):
    """Получить настройки Statix бонуса"""
    result = await db.execute(select(models.StatixBonusItem))
    return result.scalars().first()


async def create_statix_bonus_item(db: AsyncSession, item: schemas.StatixBonusItemCreate):
    """Создать настройки Statix бонуса"""
    db_item = models.StatixBonusItem(**item.model_dump())
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item


async def update_statix_bonus_item(db: AsyncSession, item_id: int, item_data: schemas.StatixBonusItemUpdate):
    """Обновить настройки Statix бонуса"""
    item = await db.get(models.StatixBonusItem, item_id)
    if not item:
        return None
    
    update_data = item_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)
    
    await db.commit()
    await db.refresh(item)
    return item


async def create_statix_bonus_purchase(db: AsyncSession, purchase: schemas.StatixBonusPurchaseRequest, user_id: int):
    """Создать покупку Statix бонуса"""
    user = await db.get(models.User, user_id)
    if not user:
        return None
    
    # Получаем настройки Statix бонуса
    statix_item = await get_statix_bonus_item(db)
    if not statix_item:
        return {"success": False, "message": "Statix бонус недоступен"}
    
    # Рассчитываем стоимость
    spasibki_price = statix_item.thanks_to_statix_rate * purchase.amount
    if user.balance < spasibki_price:
        return {"success": False, "message": "Недостаточно спасибок"}
    
    # Создаем покупку
    db_purchase = models.Purchase(
        user_id=user_id,
        item_id=None,  # Statix бонус не привязан к конкретному товару
        amount=spasibki_price,
        is_statix_bonus=True,
        statix_amount=purchase.amount
    )
    
    # Обновляем баланс
    user.balance -= spasibki_price
    
    db.add(db_purchase)
    db.add(user)
    await db.commit()
    await db.refresh(db_purchase)
    
    # Уведомление пользователя
    try:
        notification_text = (
            f"🎉 *Statix бонус приобретен!*\n\n"
            f"💰 *Сумма:* {purchase.amount} руб.\n"
            f"💵 *Стоимость:* {spasibki_price} спасибок\n"
            f"🎁 *Бонус:* {statix_item.name}"
        )
        
        await send_telegram_message(
            chat_id=user.telegram_id,
            text=notification_text
        )
    except Exception as e:
        print(f"Failed to send notification: {e}")
    
    return {
        "success": True,
        "purchase_id": db_purchase.id,
        "amount": purchase.amount,
        "spasibki_price": spasibki_price
    }
