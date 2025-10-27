# backend/crud/transactions.py

from typing import List, Optional
from datetime import datetime, date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_, or_
from sqlalchemy.orm import selectinload, aliased
import models
import schemas
from config import settings
from bot import send_telegram_message


async def create_transaction(db: AsyncSession, transaction: schemas.TransactionCreate, sender_id: int):
    """Создать транзакцию"""
    sender = await db.get(models.User, sender_id)
    if not sender:
        return None
    
    # Проверка лимита переводов в день
    today = date.today()
    today_transactions = await db.execute(
        select(func.count(models.Transaction.id))
        .where(
            and_(
                models.Transaction.sender_id == sender_id,
                func.date(models.Transaction.timestamp) == today
            )
        )
    )
    daily_count = today_transactions.scalar()
    
    if daily_count >= 3:
        raise ValueError("Превышен лимит переводов в день (3 перевода)")
    
    # Проверка баланса
    if sender.balance < transaction.amount:
        raise ValueError("Недостаточно средств")
    
    # Поиск получателя
    receiver = None
    if transaction.receiver_telegram_id:
        receiver = await db.execute(
            select(models.User).where(models.User.telegram_id == transaction.receiver_telegram_id)
        )
        receiver = receiver.scalars().first()
    
    if not receiver:
        raise ValueError("Получатель не найден")
    
    # Создание транзакции
    db_transaction = models.Transaction(
        sender_id=sender_id,
        receiver_id=receiver.id,
        amount=transaction.amount,
        message=transaction.message
    )
    
    # Обновление балансов
    sender.balance -= transaction.amount
    receiver.balance += transaction.amount
    
    # Обновление даты последнего входа
    sender.last_login_date = today
    
    db.add(db_transaction)
    db.add(sender)
    db.add(receiver)
    await db.commit()
    await db.refresh(db_transaction)
    
    # Уведомление получателя
    try:
        notification_text = (
            f"💰 *Получен перевод*\n\n"
            f"👤 *От:* {sender.first_name} {sender.last_name}\n"
            f"💵 *Сумма:* {transaction.amount} спасибок\n"
            f"💬 *Сообщение:* {transaction.message or 'Без сообщения'}"
        )
        
        await send_telegram_message(
            chat_id=receiver.telegram_id,
            text=notification_text
        )
    except Exception as e:
        print(f"Failed to send notification: {e}")
    
    return db_transaction


async def get_feed(db: AsyncSession, limit: int = 50):
    """Получить ленту транзакций"""
    result = await db.execute(
        select(models.Transaction)
        .options(
            selectinload(models.Transaction.sender),
            selectinload(models.Transaction.receiver)
        )
        .order_by(desc(models.Transaction.timestamp))
        .limit(limit)
    )
    return result.scalars().all()


async def get_user_transactions(db: AsyncSession, user_id: int, limit: int = 50):
    """Получить транзакции пользователя"""
    result = await db.execute(
        select(models.Transaction)
        .where(
            or_(
                models.Transaction.sender_id == user_id,
                models.Transaction.receiver_id == user_id
            )
        )
        .options(
            selectinload(models.Transaction.sender),
            selectinload(models.Transaction.receiver)
        )
        .order_by(desc(models.Transaction.timestamp))
        .limit(limit)
    )
    return result.scalars().all()


async def get_leaderboard_data(db: AsyncSession, period: str = "current_month", leaderboard_type: str = "received"):
    """Получить данные для таблицы лидеров"""
    today = date.today()
    
    if period == "current_month":
        start_date = today.replace(day=1)
        end_date = today
    elif period == "last_month":
        if today.month == 1:
            start_date = date(today.year - 1, 12, 1)
            end_date = date(today.year - 1, 12, 31)
        else:
            start_date = date(today.year, today.month - 1, 1)
            end_date = date(today.year, today.month - 1, 31)
    else:
        start_date = today - timedelta(days=30)
        end_date = today
    
    if leaderboard_type == "received":
        # По полученным спасибкам
        query = (
            select(
                models.User.id,
                models.User.first_name,
                models.User.last_name,
                models.User.telegram_photo_url,
                func.sum(models.Transaction.amount).label('total_received')
            )
            .select_from(
                models.Transaction.join(
                    models.User, 
                    models.Transaction.receiver_id == models.User.id
                )
            )
            .where(
                and_(
                    func.date(models.Transaction.timestamp) >= start_date,
                    func.date(models.Transaction.timestamp) <= end_date
                )
            )
            .group_by(
                models.User.id,
                models.User.first_name,
                models.User.last_name,
                models.User.telegram_photo_url
            )
            .order_by(desc('total_received'))
            .limit(50)
        )
    else:
        # По отправленным спасибкам
        query = (
            select(
                models.User.id,
                models.User.first_name,
                models.User.last_name,
                models.User.telegram_photo_url,
                func.sum(models.Transaction.amount).label('total_sent')
            )
            .select_from(
                models.Transaction.join(
                    models.User, 
                    models.Transaction.sender_id == models.User.id
                )
            )
            .where(
                and_(
                    func.date(models.Transaction.timestamp) >= start_date,
                    func.date(models.Transaction.timestamp) <= end_date
                )
            )
            .group_by(
                models.User.id,
                models.User.first_name,
                models.User.last_name,
                models.User.telegram_photo_url
            )
            .order_by(desc('total_sent'))
            .limit(50)
        )
    
    result = await db.execute(query)
    return result.all()


async def get_user_rank(db: AsyncSession, user_id: int, period: str = "current_month", leaderboard_type: str = "received"):
    """Получить позицию пользователя в таблице лидеров"""
    today = date.today()
    
    if period == "current_month":
        start_date = today.replace(day=1)
        end_date = today
    elif period == "last_month":
        if today.month == 1:
            start_date = date(today.year - 1, 12, 1)
            end_date = date(today.year - 1, 12, 31)
        else:
            start_date = date(today.year, today.month - 1, 1)
            end_date = date(today.year, today.month - 1, 31)
    else:
        start_date = today - timedelta(days=30)
        end_date = today
    
    if leaderboard_type == "received":
        # Подзапрос для получения суммы полученных спасибок пользователя
        user_total_subquery = (
            select(func.sum(models.Transaction.amount))
            .where(
                and_(
                    models.Transaction.receiver_id == user_id,
                    func.date(models.Transaction.timestamp) >= start_date,
                    func.date(models.Transaction.timestamp) <= end_date
                )
            )
            .scalar_subquery()
        )
        
        # Основной запрос для подсчета пользователей с большей суммой
        rank_query = (
            select(func.count())
            .select_from(
                select(
                    models.User.id,
                    func.sum(models.Transaction.amount).label('total_received')
                )
                .select_from(
                    models.Transaction.join(
                        models.User, 
                        models.Transaction.receiver_id == models.User.id
                    )
                )
                .where(
                    and_(
                        func.date(models.Transaction.timestamp) >= start_date,
                        func.date(models.Transaction.timestamp) <= end_date
                    )
                )
                .group_by(models.User.id)
                .having(func.sum(models.Transaction.amount) > user_total_subquery)
                .subquery()
            )
        )
    else:
        # Подзапрос для получения суммы отправленных спасибок пользователя
        user_total_subquery = (
            select(func.sum(models.Transaction.amount))
            .where(
                and_(
                    models.Transaction.sender_id == user_id,
                    func.date(models.Transaction.timestamp) >= start_date,
                    func.date(models.Transaction.timestamp) <= end_date
                )
            )
            .scalar_subquery()
        )
        
        # Основной запрос для подсчета пользователей с большей суммой
        rank_query = (
            select(func.count())
            .select_from(
                select(
                    models.User.id,
                    func.sum(models.Transaction.amount).label('total_sent')
                )
                .select_from(
                    models.Transaction.join(
                        models.User, 
                        models.Transaction.sender_id == models.User.id
                    )
                )
                .where(
                    and_(
                        func.date(models.Transaction.timestamp) >= start_date,
                        func.date(models.Transaction.timestamp) <= end_date
                    )
                )
                .group_by(models.User.id)
                .having(func.sum(models.Transaction.amount) > user_total_subquery)
                .subquery()
            )
        )
    
    result = await db.execute(rank_query)
    rank = result.scalar()
    return rank + 1 if rank is not None else 1


async def get_leaderboards_status(db: AsyncSession):
    """Получить статус таблиц лидеров"""
    today = date.today()
    
    # Текущий месяц
    current_month_start = today.replace(day=1)
    current_month_transactions = await db.execute(
        select(func.count(models.Transaction.id))
        .where(
            and_(
                func.date(models.Transaction.timestamp) >= current_month_start,
                func.date(models.Transaction.timestamp) <= today
            )
        )
    )
    current_month_count = current_month_transactions.scalar() or 0
    
    # Прошлый месяц
    if today.month == 1:
        last_month_start = date(today.year - 1, 12, 1)
        last_month_end = date(today.year - 1, 12, 31)
    else:
        last_month_start = date(today.year, today.month - 1, 1)
        last_month_end = date(today.year, today.month - 1, 31)
    
    last_month_transactions = await db.execute(
        select(func.count(models.Transaction.id))
        .where(
            and_(
                func.date(models.Transaction.timestamp) >= last_month_start,
                func.date(models.Transaction.timestamp) <= last_month_end
            )
        )
    )
    last_month_count = last_month_transactions.scalar() or 0
    
    return {
        "current_month": {
            "transactions_count": current_month_count,
            "has_data": current_month_count > 0
        },
        "last_month": {
            "transactions_count": last_month_count,
            "has_data": last_month_count > 0
        }
    }
