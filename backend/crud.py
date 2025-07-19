# backend/crud.py
from sqlalchemy.future import select
from sqlalchemy import func, update
from sqlalchemy.ext.asyncio import AsyncSession
import models, schemas

# Пользователи
async def get_user(db: AsyncSession, user_id: int):
    result = await db.execute(select(models.User).where(models.User.id == user_id))
    return result.scalars().first()

# ИЗМЕНЕНИЕ: Ожидаем telegram_id как число (int)
async def get_user_by_telegram(db: AsyncSession, telegram_id: int):
    result = await db.execute(select(models.User).where(models.User.telegram_id == telegram_id))
    return result.scalars().first()

async def create_user(db: AsyncSession, user: schemas.RegisterRequest):
    db_user = models.User(
        # ИЗМЕНЕНИЕ: Преобразуем текстовый ID в число перед сохранением
        telegram_id=int(user.telegram_id),
        position=user.position,
        last_name=user.last_name,
        department=user.department
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user
# ... (остальной код файла без изменений)

async def get_users(db: AsyncSession):
    result = await db.execute(select(models.User))
    return result.scalars().all()

# Транзакции
async def create_transaction(db: AsyncSession, tr: schemas.TransferRequest):
    db_tr = models.Transaction(
        sender_id=tr.sender_id,
        receiver_id=tr.receiver_id,
        amount=tr.amount,
        message=tr.message
    )
    # Обновляем балансы
    await db.execute(
        update(models.User)
        .where(models.User.id == tr.sender_id)
        .values(balance=models.User.balance - tr.amount)
    )
    await db.execute(
        update(models.User)
        .where(models.User.id == tr.receiver_id)
        .values(balance=models.User.balance + tr.amount)
    )
    db.add(db_tr)
    await db.commit()
    await db.refresh(db_tr)
    return db_tr

async def get_feed(db: AsyncSession):
    result = await db.execute(select(models.Transaction).order_by(models.Transaction.timestamp.desc()))
    return result.scalars().all()

# Лидерборд
async def get_leaderboard(db: AsyncSession, limit: int = 3):
    result = await db.execute(
        select(
            models.Transaction.receiver_id.label('user_id'),
            func.sum(models.Transaction.amount).label('total_received')
        )
        .group_by(models.Transaction.receiver_id)
        .order_by(func.sum(models.Transaction.amount).desc())
        .limit(limit)
    )
    return result.all()

# Маркет
async def get_market_items(db: AsyncSession):
    result = await db.execute(select(models.MarketItem))
    return result.scalars().all()

async def create_purchase(db: AsyncSession, pr: schemas.PurchaseRequest):
    db_purchase = models.Purchase(
        user_id=pr.user_id,
        item_id=pr.item_id
    )
    # Снижение запаса и списание баллов
    await db.execute(
        update(models.MarketItem)
        .where(models.MarketItem.id == pr.item_id)
        .values(stock=models.MarketItem.stock - 1)
    )
    await db.execute(
        update(models.User)
        .where(models.User.id == pr.user_id)
        .values(balance=models.User.balance - (await db.get(models.MarketItem, pr.item_id)).price)
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
