# backend/crud/market.py

from typing import List, Optional
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_
from sqlalchemy.orm import selectinload
import models
import schemas
from config import settings
from bot import send_telegram_message
import random
import string


async def get_market_items(db: AsyncSession):
    """Получить все товары маркета"""
    result = await db.execute(
        select(models.MarketItem)
        .options(selectinload(models.MarketItem.item_codes))
        .order_by(desc(models.MarketItem.created_at))
    )
    return result.scalars().all()


async def get_active_items(db: AsyncSession):
    """Получить активные товары маркета"""
    result = await db.execute(
        select(models.MarketItem)
        .where(models.MarketItem.is_active == True)
        .options(selectinload(models.MarketItem.item_codes))
        .order_by(desc(models.MarketItem.created_at))
    )
    return result.scalars().all()


async def create_market_item(db: AsyncSession, item: schemas.MarketItemCreate):
    """Создать товар маркета"""
    db_item = models.MarketItem(**item.model_dump())
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item


async def admin_create_market_item(db: AsyncSession, item: schemas.MarketItemCreate, admin_user: models.User):
    """Создать товар маркета от имени администратора"""
    db_item = models.MarketItem(**item.model_dump())
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    
    # Логирование
    admin_name = f"@{admin_user.username}" if admin_user.username else f"{admin_user.first_name} {admin_user.last_name}"
    log_message = (
        f"🛍️ *Создан новый товар*\n\n"
        f"👤 *Администратор:* {admin_name}\n"
        f"📦 *Товар:* {db_item.name}\n"
        f"💰 *Цена:* {db_item.price_rubles} руб. / {db_item.price_spasibki} спасибок"
    )
    
    await send_telegram_message(
        chat_id=settings.TELEGRAM_CHAT_ID,
        text=log_message,
        message_thread_id=settings.TELEGRAM_ADMIN_LOG_TOPIC_ID
    )
    
    return db_item


async def admin_update_market_item(db: AsyncSession, item_id: int, item_data: schemas.MarketItemUpdate, admin_user: models.User):
    """Обновить товар маркета от имени администратора"""
    item = await db.get(models.MarketItem, item_id)
    if not item:
        return None
    
    update_data = item_data.model_dump(exclude_unset=True)
    changes_log = []
    
    for key, new_value in update_data.items():
        old_value = getattr(item, key, None)
        if old_value != new_value:
            changes_log.append(f"  - {key}: `{old_value}` -> `{new_value}`")
        setattr(item, key, new_value)
    
    if changes_log:
        await db.commit()
        await db.refresh(item)
        
        admin_name = f"@{admin_user.username}" if admin_user.username else f"{admin_user.first_name} {admin_user.last_name}"
        log_message = (
            f"✏️ *Товар обновлен*\n\n"
            f"👤 *Администратор:* {admin_name}\n"
            f"📦 *Товар:* {item.name}\n\n"
            f"*Изменения:*\n" + "\n".join(changes_log)
        )
        
        await send_telegram_message(
            chat_id=settings.TELEGRAM_CHAT_ID,
            text=log_message,
            message_thread_id=settings.TELEGRAM_ADMIN_LOG_TOPIC_ID
        )
    
    return item


async def archive_market_item(db: AsyncSession, item_id: int):
    """Архивировать товар маркета"""
    item = await db.get(models.MarketItem, item_id)
    if item:
        item.is_active = False
        await db.commit()
        await db.refresh(item)
    return item


async def get_archived_items(db: AsyncSession):
    """Получить архивированные товары"""
    result = await db.execute(
        select(models.MarketItem)
        .where(models.MarketItem.is_active == False)
        .order_by(desc(models.MarketItem.created_at))
    )
    return result.scalars().all()


async def admin_delete_item_permanently(db: AsyncSession, item_id: int, admin_user: models.User):
    """Удалить товар навсегда"""
    item = await db.get(models.MarketItem, item_id)
    if not item:
        return None
    
    item_name = item.name
    await db.delete(item)
    await db.commit()
    
    admin_name = f"@{admin_user.username}" if admin_user.username else f"{admin_user.first_name} {admin_user.last_name}"
    log_message = (
        f"🗑️ *Товар удален навсегда*\n\n"
        f"👤 *Администратор:* {admin_name}\n"
        f"📦 *Товар:* {item_name}"
    )
    
    await send_telegram_message(
        chat_id=settings.TELEGRAM_CHAT_ID,
        text=log_message,
        message_thread_id=settings.TELEGRAM_ADMIN_LOG_TOPIC_ID
    )
    
    return True


async def admin_restore_market_item(db: AsyncSession, item_id: int, admin_user: models.User):
    """Восстановить товар из архива"""
    item = await db.get(models.MarketItem, item_id)
    if not item:
        return None
    
    item.is_active = True
    await db.commit()
    await db.refresh(item)
    
    admin_name = f"@{admin_user.username}" if admin_user.username else f"{admin_user.first_name} {admin_user.last_name}"
    log_message = (
        f"♻️ *Товар восстановлен*\n\n"
        f"👤 *Администратор:* {admin_name}\n"
        f"📦 *Товар:* {item.name}"
    )
    
    await send_telegram_message(
        chat_id=settings.TELEGRAM_CHAT_ID,
        text=log_message,
        message_thread_id=settings.TELEGRAM_ADMIN_LOG_TOPIC_ID
    )
    
    return item


async def create_purchase(db: AsyncSession, purchase: schemas.PurchaseCreate, user_id: int):
    """Создать покупку"""
    user = await db.get(models.User, user_id)
    if not user:
        return None
    
    item = await db.get(models.MarketItem, purchase.item_id)
    if not item or not item.is_active:
        raise ValueError("Товар не найден или неактивен")
    
    # Проверка баланса
    if user.balance < item.price_spasibki:
        raise ValueError("Недостаточно спасибок")
    
    # Создание покупки
    db_purchase = models.Purchase(
        user_id=user_id,
        item_id=purchase.item_id,
        amount=item.price_spasibki
    )
    
    # Обновление баланса
    user.balance -= item.price_spasibki
    
    db.add(db_purchase)
    db.add(user)
    await db.commit()
    await db.refresh(db_purchase)
    
    # Обработка автовыдачи
    if item.auto_issue:
        # Генерация уникального кода
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        
        # Создание записи кода
        item_code = models.ItemCode(
            item_id=item.id,
            purchase_id=db_purchase.id,
            code=code,
            is_used=False
        )
        db.add(item_code)
        await db.commit()
        await db.refresh(item_code)
        
        # Уведомление пользователя
        try:
            notification_text = (
                f"🎉 *Покупка успешна!*\n\n"
                f"📦 *Товар:* {item.name}\n"
                f"🔑 *Код:* `{code}`\n"
                f"💵 *Стоимость:* {item.price_spasibki} спасибок"
            )
            
            await send_telegram_message(
                chat_id=user.telegram_id,
                text=notification_text
            )
        except Exception as e:
            print(f"Failed to send notification: {e}")
    
    # Уведомление админа
    try:
        admin_notification = (
            f"🛒 *Новая покупка*\n\n"
            f"👤 *Покупатель:* {user.first_name} {user.last_name}\n"
            f"📦 *Товар:* {item.name}\n"
            f"💵 *Стоимость:* {item.price_spasibki} спасибок"
        )
        
        await send_telegram_message(
            chat_id=settings.TELEGRAM_CHAT_ID,
            text=admin_notification,
            message_thread_id=settings.TELEGRAM_PURCHASE_TOPIC_ID
        )
    except Exception as e:
        print(f"Failed to send admin notification: {e}")
    
    return db_purchase


def calculate_spasibki_price(price_rubles: int) -> int:
    """Рассчитать цену в спасибках"""
    return max(1, price_rubles // 10)


def calculate_accumulation_forecast(price_rubles: int, current_balance: int) -> int:
    """Рассчитать прогноз накопления"""
    spasibki_price = calculate_spasibki_price(price_rubles)
    if current_balance >= spasibki_price:
        return 0
    
    needed = spasibki_price - current_balance
    # Предполагаем, что пользователь получает 10 спасибок в день
    daily_income = 10
    return (needed + daily_income - 1) // daily_income
