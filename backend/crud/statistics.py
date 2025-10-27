# backend/crud/statistics.py

from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_, or_, text
from sqlalchemy.orm import selectinload
import models
import schemas


async def get_general_statistics(db: AsyncSession):
    """Получить общую статистику"""
    # Общее количество пользователей
    total_users_result = await db.execute(select(func.count(models.User.id)))
    total_users = total_users_result.scalar() or 0
    
    # Активные пользователи (за последние 30 дней)
    thirty_days_ago = date.today() - timedelta(days=30)
    active_users_result = await db.execute(
        select(func.count(models.User.id))
        .where(models.User.last_login_date >= thirty_days_ago)
    )
    active_users = active_users_result.scalar() or 0
    
    # Общий баланс
    total_balance_result = await db.execute(select(func.sum(models.User.balance)))
    total_balance = total_balance_result.scalar() or 0
    
    # Количество транзакций за последние 30 дней
    transactions_count_result = await db.execute(
        select(func.count(models.Transaction.id))
        .where(models.Transaction.timestamp >= thirty_days_ago)
    )
    transactions_count = transactions_count_result.scalar() or 0
    
    # Количество покупок за последние 30 дней
    purchases_count_result = await db.execute(
        select(func.count(models.Purchase.id))
        .where(models.Purchase.timestamp >= thirty_days_ago)
    )
    purchases_count = purchases_count_result.scalar() or 0
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_balance": total_balance,
        "transactions_count": transactions_count,
        "purchases_count": purchases_count
    }


async def get_hourly_activity_stats(db: AsyncSession, days: int = 7):
    """Получить статистику активности по часам"""
    start_date = date.today() - timedelta(days=days)
    
    result = await db.execute(
        select(
            func.extract('hour', models.Transaction.timestamp).label('hour'),
            func.count(models.Transaction.id).label('count')
        )
        .where(models.Transaction.timestamp >= start_date)
        .group_by(func.extract('hour', models.Transaction.timestamp))
        .order_by('hour')
    )
    
    return result.all()


async def get_login_activity_stats(db: AsyncSession, days: int = 30):
    """Получить статистику активности входа"""
    start_date = date.today() - timedelta(days=days)
    
    result = await db.execute(
        select(
            func.date(models.User.last_login_date).label('date'),
            func.count(models.User.id).label('logins')
        )
        .where(models.User.last_login_date >= start_date)
        .group_by(func.date(models.User.last_login_date))
        .order_by('date')
    )
    
    return result.all()


async def get_user_engagement_stats(db: AsyncSession, days: int = 30):
    """Получить статистику вовлеченности пользователей"""
    start_date = date.today() - timedelta(days=days)
    
    # Пользователи с транзакциями
    users_with_transactions = await db.execute(
        select(func.count(func.distinct(models.Transaction.sender_id)))
        .where(models.Transaction.timestamp >= start_date)
    )
    users_with_transactions_count = users_with_transactions.scalar() or 0
    
    # Пользователи с покупками
    users_with_purchases = await db.execute(
        select(func.count(func.distinct(models.Purchase.user_id)))
        .where(models.Purchase.timestamp >= start_date)
    )
    users_with_purchases_count = users_with_purchases.scalar() or 0
    
    # Общее количество пользователей
    total_users_result = await db.execute(select(func.count(models.User.id)))
    total_users = total_users_result.scalar() or 0
    
    return {
        "users_with_transactions": users_with_transactions_count,
        "users_with_purchases": users_with_purchases_count,
        "total_users": total_users,
        "transaction_engagement_rate": (users_with_transactions_count / total_users * 100) if total_users > 0 else 0,
        "purchase_engagement_rate": (users_with_purchases_count / total_users * 100) if total_users > 0 else 0
    }


async def get_popular_items_stats(db: AsyncSession, days: int = 30):
    """Получить статистику популярных товаров"""
    start_date = date.today() - timedelta(days=days)
    
    result = await db.execute(
        select(
            models.MarketItem.name,
            models.MarketItem.price_spasibki,
            func.count(models.Purchase.id).label('purchases_count'),
            func.sum(models.Purchase.amount).label('total_revenue')
        )
        .join(models.Purchase, models.MarketItem.id == models.Purchase.item_id)
        .where(models.Purchase.timestamp >= start_date)
        .group_by(models.MarketItem.id, models.MarketItem.name, models.MarketItem.price_spasibki)
        .order_by(desc('purchases_count'))
        .limit(10)
    )
    
    return result.all()


async def get_inactive_users(db: AsyncSession, days: int = 30):
    """Получить неактивных пользователей"""
    cutoff_date = date.today() - timedelta(days=days)
    
    result = await db.execute(
        select(models.User)
        .where(models.User.last_login_date < cutoff_date)
        .order_by(models.User.last_login_date)
    )
    
    return result.scalars().all()


async def get_total_balance(db: AsyncSession):
    """Получить общий баланс всех пользователей"""
    result = await db.execute(select(func.sum(models.User.balance)))
    return result.scalar() or 0


async def get_active_user_ratio(db: AsyncSession, days: int = 30):
    """Получить соотношение активных пользователей"""
    cutoff_date = date.today() - timedelta(days=days)
    
    # Активные пользователи
    active_users_result = await db.execute(
        select(func.count(models.User.id))
        .where(models.User.last_login_date >= cutoff_date)
    )
    active_users = active_users_result.scalar() or 0
    
    # Общее количество пользователей
    total_users_result = await db.execute(select(func.count(models.User.id)))
    total_users = total_users_result.scalar() or 0
    
    return {
        "active_users": active_users,
        "total_users": total_users,
        "ratio": (active_users / total_users * 100) if total_users > 0 else 0
    }


async def get_average_session_duration(db: AsyncSession, days: int = 30):
    """Получить среднюю продолжительность сессий"""
    start_date = date.today() - timedelta(days=days)
    
    result = await db.execute(
        select(
            func.avg(
                func.extract('epoch', models.UserSession.end_time - models.UserSession.start_time)
            ).label('avg_duration_seconds')
        )
        .where(
            and_(
                models.UserSession.start_time >= start_date,
                models.UserSession.end_time.isnot(None)
            )
        )
    )
    
    avg_duration = result.scalar()
    if avg_duration:
        return {
            "avg_duration_seconds": avg_duration,
            "avg_duration_minutes": avg_duration / 60,
            "avg_duration_hours": avg_duration / 3600
        }
    
    return {
        "avg_duration_seconds": 0,
        "avg_duration_minutes": 0,
        "avg_duration_hours": 0
    }
