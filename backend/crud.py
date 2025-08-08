# backend/crud.py

from sqlalchemy.future import select
from sqlalchemy import func, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
import models, schemas
from bot import send_telegram_message
from database import settings

# Пользователи
async def get_user(db: AsyncSession, user_id: int):
    result = await db.execute(select(models.User).where(models.User.id == user_id))
    return result.scalars().first()

async def get_user_by_telegram(db: AsyncSession, telegram_id: int):
    result = await db.execute(select(models.User).where(models.User.telegram_id == telegram_id))
    return result.scalars().first()

async def create_user(db: AsyncSession, user: schemas.RegisterRequest):
    user_telegram_id = int(user.telegram_id)
    is_admin = (user_telegram_id == settings.TELEGRAM_ADMIN_ID)
    db_user = models.User(
        telegram_id=user_telegram_id,
        position=user.position,
        last_name=user.last_name,
        department=user.department,
        username=user.username,
        is_admin=is_admin,
        phone_number=user.phone_number,
        date_of_birth=user.date_of_birth
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

async def get_users(db: AsyncSession):
    result = await db.execute(select(models.User))
    return result.scalars().all()

async def update_user_profile(db: AsyncSession, user_id: int, data: schemas.UserUpdate):
    user = await get_user(db, user_id)
    if not user:
        return None
    
    update_data = data.dict(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(user, key, value)
        
    await db.commit()
    await db.refresh(user)
    return user

# Транзакции
async def create_transaction(db: AsyncSession, tr: schemas.TransferRequest):
    sender = await get_user(db, tr.sender_id)
    receiver = await get_user(db, tr.receiver_id)
    if not sender or not receiver:
        raise ValueError("Sender or Receiver not found")
    if sender.balance < tr.amount:
        raise ValueError("Insufficient balance")

    sender.balance -= tr.amount
    receiver.balance += tr.amount
    db_tr = models.Transaction(
        sender_id=tr.sender_id,
        receiver_id=tr.receiver_id,
        amount=tr.amount,
        message=tr.message
    )
    db.add(db_tr)
    await db.commit()
    await db.refresh(db_tr)
    
    try:
        message_text = (f"🎉 Вам начислено *{tr.amount}* баллов!\n"
                        f"От: *{sender.last_name}*\n"
                        f"Сообщение: _{tr.message}_")
        await send_telegram_message(chat_id=receiver.telegram_id, text=message_text)
    except Exception as e:
        print(f"Could not send notification to user {receiver.telegram_id}. Error: {e}")
    
    return db_tr

async def get_feed(db: AsyncSession):
    result = await db.execute(
        select(models.Transaction).order_by(models.Transaction.timestamp.desc())
    )
    return result.scalars().all()

async def get_user_transactions(db: AsyncSession, user_id: int):
    result = await db.execute(
        select(models.Transaction)
        .where((models.Transaction.sender_id == user_id) | (models.Transaction.receiver_id == user_id))
        .order_by(models.Transaction.timestamp.desc())
    )
    return result.scalars().all()

# Лидерборд
async def get_leaderboard(db: AsyncSession, limit: int = 10):
    today = datetime.utcnow()
    first_day_of_current_month = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_day_of_last_month = first_day_of_current_month - timedelta(days=1)
    first_day_of_last_month = last_day_of_last_month.replace(day=1)

    result = await db.execute(
        select(
            models.User,
            func.sum(models.Transaction.amount).label("total_received"),
        )
        .join(models.Transaction, models.User.id == models.Transaction.receiver_id)
        .where(models.Transaction.timestamp >= first_day_of_last_month)
        .where(models.Transaction.timestamp < first_day_of_current_month)
        .group_by(models.User.id)
        .order_by(func.sum(models.Transaction.amount).desc())
        .limit(limit)
    )
    
    leaderboard_data = result.all()
    return [{"user": user, "total_received": total_received or 0} for user, total_received in leaderboard_data]

# Маркет
async def get_market_items(db: AsyncSession):
    result = await db.execute(select(models.MarketItem))
    return result.scalars().all()

async def create_market_item(db: AsyncSession, item: schemas.MarketItemCreate):
    db_item = models.MarketItem(**item.dict())
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item

async def create_purchase(db: AsyncSession, pr: schemas.PurchaseRequest):
    item = await db.get(models.MarketItem, pr.item_id)
    user = await db.get(models.User, pr.user_id)

    if not item or not user:
        raise ValueError("Item or User not found")
    if item.stock <= 0:
        raise ValueError("Item out of stock")
    if user.balance < item.price:
        raise ValueError("Insufficient balance")

    # Сначала вычитаем, потом сохраняем
    item.stock -= 1
    user.balance -= item.price

    db_purchase = models.Purchase(user_id=pr.user_id, item_id=pr.item_id)
    db.add(db_purchase)
    
    # --- ИЗМЕНЕНИЕ: ОТПРАВЛЯЕМ УВЕДОМЛЕНИЕ ДО COMMIT ---
    try:
        user_tag = f"@{user.username}" if user.username else f"ID: {user.telegram_id}"
        admin_message = (
            f"🛍️ *Новая покупка в магазине!*\n\n"
            f"👤 *Пользователь:* {user.last_name} ({user_tag})\n" # <-- Используем username
            f"💼 *Должность:* {user.position}\n\n"
            f"🎁 *Товар:* {item.name}\n"
            f"💰 *Стоимость:* {item.price} баллов\n\n"
            f"📉 *Новый баланс пользователя:* {user.balance} баллов"
        )
        await send_telegram_message(chat_id=settings.TELEGRAM_CHAT_ID, text=admin_message)
    except Exception as e:
        print(f"Could not send admin notification. Error: {e}")

    # Сохраняем все изменения в базе
    await db.commit()
    
    return user.balance

# Админ
async def add_points_to_all_users(db: AsyncSession, amount: int):
    await db.execute(update(models.User).values(balance=models.User.balance + amount))
    await db.commit()
    return True

async def reset_balances(db: AsyncSession):
    await db.execute(update(models.User).values(balance=0))
    await db.commit()
    return True
