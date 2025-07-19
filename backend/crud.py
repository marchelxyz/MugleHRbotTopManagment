# backend/crud.py

from sqlalchemy.future import select
from sqlalchemy import func, update, BigInteger
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
import models, schemas

# Пользователи
async def get_user(db: AsyncSession, user_id: int):
    result = await db.execute(select(models.User).where(models.User.id == user_id))
    return result.scalars().first()

async def get_user_by_telegram(db: AsyncSession, telegram_id: int):
    result = await db.execute(select(models.User).where(models.User.telegram_id == telegram_id))
    return result.scalars().first()

async def create_user(db: AsyncSession, user: schemas.RegisterRequest):
    db_user = models.User(
        telegram_id=int(user.telegram_id),
        position=user.position,
        last_name=user.last_name,
        department=user.department
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

async def get_users(db: AsyncSession):
    result = await db.execute(select(models.User))
    return result.scalars().all()

# Транзакции
async def create_transaction(db: AsyncSession, tr: schemas.TransferRequest):
    sender = await get_user(db, tr.sender_id)
    receiver = await get_user(db, tr.receiver_id)

    # Обновляем балансы
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
    return db_tr

async def get_feed(db: AsyncSession):
    result = await db.execute(
        select(models.Transaction).order_by(models.Transaction.timestamp.desc())
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

async def create_purchase(db: AsyncSession, pr: schemas.PurchaseRequest):
    item = await db.get(models.MarketItem, pr.item_id)
    user = await db.get(models.User, pr.user_id)

    if not item or not user:
        raise ValueError("Item or User not found")
    if item.stock <= 0:
        raise ValueError("Item out of stock")
    if user.balance < item.price:
        raise ValueError("Insufficient balance")

    item.stock -= 1
    user.balance -= item.price

    db_purchase = models.Purchase(
        user_id=pr.user_id,
        item_id=pr.item_id
    )
    db.add(db_purchase)
    await db.commit()
    await db.refresh(db_purchase)
    return db_purchase

# Админ
async def reset_balances(db: AsyncSession):
    await db.execute(update(models.User).values(balance=0))
    await db.commit()
    return True
