# backend/crud/admin.py

from typing import List, Optional
from datetime import datetime, date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_, update
from sqlalchemy.orm import selectinload
import models
import schemas
from config import settings
from bot import send_telegram_message


async def add_points_to_all_users(db: AsyncSession, points: int, admin_user: models.User):
    """Добавить спасибки всем пользователям"""
    # Получаем всех пользователей
    result = await db.execute(select(models.User))
    users = result.scalars().all()
    
    # Обновляем балансы
    for user in users:
        user.balance += points
    
    await db.commit()
    
    # Логирование
    admin_name = f"@{admin_user.username}" if admin_user.username else f"{admin_user.first_name} {admin_user.last_name}"
    log_message = (
        f"💰 *Массовое начисление спасибок*\n\n"
        f"👤 *Администратор:* {admin_name}\n"
        f"💵 *Сумма:* {points} спасибок каждому\n"
        f"👥 *Пользователей:* {len(users)}"
    )
    
    await send_telegram_message(
        chat_id=settings.TELEGRAM_CHAT_ID,
        text=log_message,
        message_thread_id=settings.TELEGRAM_ADMIN_LOG_TOPIC_ID
    )
    
    return {"users_updated": len(users), "points_added": points}


async def add_tickets_to_all_users(db: AsyncSession, tickets: int, admin_user: models.User):
    """Добавить билеты всем пользователям"""
    # Получаем всех пользователей
    result = await db.execute(select(models.User))
    users = result.scalars().all()
    
    # Обновляем билеты
    for user in users:
        user.tickets += tickets
    
    await db.commit()
    
    # Логирование
    admin_name = f"@{admin_user.username}" if admin_user.username else f"{admin_user.first_name} {admin_user.last_name}"
    log_message = (
        f"🎫 *Массовое начисление билетов*\n\n"
        f"👤 *Администратор:* {admin_name}\n"
        f"🎫 *Количество:* {tickets} билетов каждому\n"
        f"👥 *Пользователей:* {len(users)}"
    )
    
    await send_telegram_message(
        chat_id=settings.TELEGRAM_CHAT_ID,
        text=log_message,
        message_thread_id=settings.TELEGRAM_ADMIN_LOG_TOPIC_ID
    )
    
    return {"users_updated": len(users), "tickets_added": tickets}


async def reset_balances(db: AsyncSession, admin_user: models.User):
    """Сбросить балансы всех пользователей"""
    # Получаем всех пользователей
    result = await db.execute(select(models.User))
    users = result.scalars().all()
    
    # Сбрасываем балансы
    for user in users:
        user.balance = 0
    
    await db.commit()
    
    # Логирование
    admin_name = f"@{admin_user.username}" if admin_user.username else f"{admin_user.first_name} {admin_user.last_name}"
    log_message = (
        f"🔄 *Сброс балансов*\n\n"
        f"👤 *Администратор:* {admin_name}\n"
        f"👥 *Пользователей:* {len(users)}"
    )
    
    await send_telegram_message(
        chat_id=settings.TELEGRAM_CHAT_ID,
        text=log_message,
        message_thread_id=settings.TELEGRAM_ADMIN_LOG_TOPIC_ID
    )
    
    return {"users_updated": len(users)}


async def get_active_banners(db: AsyncSession):
    """Получить активные баннеры"""
    result = await db.execute(
        select(models.Banner)
        .where(models.Banner.is_active == True)
        .order_by(desc(models.Banner.created_at))
    )
    return result.scalars().all()


async def get_all_banners(db: AsyncSession):
    """Получить все баннеры"""
    result = await db.execute(
        select(models.Banner)
        .order_by(desc(models.Banner.created_at))
    )
    return result.scalars().all()


async def create_banner(db: AsyncSession, banner: schemas.BannerCreate, admin_user: models.User):
    """Создать баннер"""
    db_banner = models.Banner(**banner.model_dump())
    db.add(db_banner)
    await db.commit()
    await db.refresh(db_banner)
    
    # Логирование
    admin_name = f"@{admin_user.username}" if admin_user.username else f"{admin_user.first_name} {admin_user.last_name}"
    log_message = (
        f"📢 *Создан новый баннер*\n\n"
        f"👤 *Администратор:* {admin_name}\n"
        f"📝 *Текст:* {db_banner.text[:50]}..."
    )
    
    await send_telegram_message(
        chat_id=settings.TELEGRAM_CHAT_ID,
        text=log_message,
        message_thread_id=settings.TELEGRAM_ADMIN_LOG_TOPIC_ID
    )
    
    return db_banner


async def update_banner(db: AsyncSession, banner_id: int, banner_data: schemas.BannerUpdate, admin_user: models.User):
    """Обновить баннер"""
    banner = await db.get(models.Banner, banner_id)
    if not banner:
        return None
    
    update_data = banner_data.model_dump(exclude_unset=True)
    changes_log = []
    
    for key, new_value in update_data.items():
        old_value = getattr(banner, key, None)
        if old_value != new_value:
            changes_log.append(f"  - {key}: `{old_value}` -> `{new_value}`")
        setattr(banner, key, new_value)
    
    if changes_log:
        await db.commit()
        await db.refresh(banner)
        
        admin_name = f"@{admin_user.username}" if admin_user.username else f"{admin_user.first_name} {admin_user.last_name}"
        log_message = (
            f"✏️ *Баннер обновлен*\n\n"
            f"👤 *Администратор:* {admin_name}\n"
            f"📝 *Баннер:* {banner.text[:50]}...\n\n"
            f"*Изменения:*\n" + "\n".join(changes_log)
        )
        
        await send_telegram_message(
            chat_id=settings.TELEGRAM_CHAT_ID,
            text=log_message,
            message_thread_id=settings.TELEGRAM_ADMIN_LOG_TOPIC_ID
        )
    
    return banner


async def delete_banner(db: AsyncSession, banner_id: int, admin_user: models.User):
    """Удалить баннер"""
    banner = await db.get(models.Banner, banner_id)
    if not banner:
        return None
    
    banner_text = banner.text
    await db.delete(banner)
    await db.commit()
    
    admin_name = f"@{admin_user.username}" if admin_user.username else f"{admin_user.first_name} {admin_user.last_name}"
    log_message = (
        f"🗑️ *Баннер удален*\n\n"
        f"👤 *Администратор:* {admin_name}\n"
        f"📝 *Баннер:* {banner_text[:50]}..."
    )
    
    await send_telegram_message(
        chat_id=settings.TELEGRAM_CHAT_ID,
        text=log_message,
        message_thread_id=settings.TELEGRAM_ADMIN_LOG_TOPIC_ID
    )
    
    return True


async def process_birthday_bonuses(db: AsyncSession):
    """Обработать бонусы на день рождения"""
    today = date.today()
    
    # Находим пользователей с днем рождения сегодня
    result = await db.execute(
        select(models.User).where(
            and_(
                models.User.date_of_birth.isnot(None),
                func.extract('month', models.User.date_of_birth) == today.month,
                func.extract('day', models.User.date_of_birth) == today.day
            )
        )
    )
    birthday_users = result.scalars().all()
    
    bonus_amount = 50  # Бонус на день рождения
    updated_users = []
    
    for user in birthday_users:
        user.balance += bonus_amount
        updated_users.append(user)
    
    if updated_users:
        await db.commit()
        
        # Уведомление админа
        log_message = (
            f"🎂 *Обработка бонусов на день рождения*\n\n"
            f"👥 *Пользователей:* {len(updated_users)}\n"
            f"💰 *Бонус:* {bonus_amount} спасибок каждому"
        )
        
        await send_telegram_message(
            chat_id=settings.TELEGRAM_CHAT_ID,
            text=log_message,
            message_thread_id=settings.TELEGRAM_ADMIN_LOG_TOPIC_ID
        )
    
    return {"users_updated": len(updated_users), "bonus_amount": bonus_amount}


async def update_user_status(db: AsyncSession, user_id: int, status: str, admin_user: models.User):
    """Обновить статус пользователя"""
    user = await db.get(models.User, user_id)
    if not user:
        return None
    
    old_status = user.status
    user.status = status
    
    await db.commit()
    await db.refresh(user)
    
    # Логирование
    admin_name = f"@{admin_user.username}" if admin_user.username else f"{admin_user.first_name} {admin_user.last_name}"
    user_name = f"@{user.username}" if user.username else f"{user.first_name} {user.last_name}"
    
    log_message = (
        f"👤 *Изменен статус пользователя*\n\n"
        f"👤 *Администратор:* {admin_name}\n"
        f"🎯 *Пользователь:* {user_name}\n"
        f"📊 *Статус:* {old_status} → {status}"
    )
    
    await send_telegram_message(
        chat_id=settings.TELEGRAM_CHAT_ID,
        text=log_message,
        message_thread_id=settings.TELEGRAM_ADMIN_LOG_TOPIC_ID
    )
    
    return user


async def process_profile_update(db: AsyncSession, update_id: int, action: str, admin_user: models.User):
    """Обработать запрос на обновление профиля"""
    pending_update = await db.get(models.PendingUpdate, update_id)
    if not pending_update:
        return None
    
    user = await db.get(models.User, pending_update.user_id)
    if not user:
        return None
    
    if action == "approve":
        # Применяем изменения
        update_data = pending_update.update_data
        for key, value in update_data.items():
            if hasattr(user, key):
                setattr(user, key, value)
        
        user.status = "approved"
        await db.delete(pending_update)
        await db.commit()
        
        # Уведомление пользователя
        try:
            notification_text = (
                f"✅ *Обновление профиля одобрено*\n\n"
                f"Ваши изменения были успешно применены."
            )
            
            await send_telegram_message(
                chat_id=user.telegram_id,
                text=notification_text
            )
        except Exception as e:
            print(f"Failed to send notification: {e}")
    
    elif action == "reject":
        user.status = "rejected"
        await db.delete(pending_update)
        await db.commit()
        
        # Уведомление пользователя
        try:
            notification_text = (
                f"❌ *Обновление профиля отклонено*\n\n"
                f"Ваши изменения не были применены."
            )
            
            await send_telegram_message(
                chat_id=user.telegram_id,
                text=notification_text
            )
        except Exception as e:
            print(f"Failed to send notification: {e}")
    
    # Логирование
    admin_name = f"@{admin_user.username}" if admin_user.username else f"{admin_user.first_name} {admin_user.last_name}"
    user_name = f"@{user.username}" if user.username else f"{user.first_name} {user.last_name}"
    
    log_message = (
        f"📝 *Обработка запроса на обновление профиля*\n\n"
        f"👤 *Администратор:* {admin_name}\n"
        f"🎯 *Пользователь:* {user_name}\n"
        f"⚡ *Действие:* {action}"
    )
    
    await send_telegram_message(
        chat_id=settings.TELEGRAM_CHAT_ID,
        text=log_message,
        message_thread_id=settings.TELEGRAM_ADMIN_LOG_TOPIC_ID
    )
    
    return user


async def request_profile_update(db: AsyncSession, user_id: int, update_data: dict):
    """Запросить обновление профиля"""
    # Создаем запрос на обновление
    pending_update = models.PendingUpdate(
        user_id=user_id,
        update_data=update_data
    )
    
    db.add(pending_update)
    await db.commit()
    await db.refresh(pending_update)
    
    # Уведомление админа
    user = await db.get(models.User, user_id)
    if user:
        user_name = f"@{user.username}" if user.username else f"{user.first_name} {user.last_name}"
        
        log_message = (
            f"📝 *Запрос на обновление профиля*\n\n"
            f"👤 *Пользователь:* {user_name}\n"
            f"📊 *ID запроса:* {pending_update.id}"
        )
        
        await send_telegram_message(
            chat_id=settings.TELEGRAM_CHAT_ID,
            text=log_message,
            message_thread_id=settings.TELEGRAM_ADMIN_TOPIC_ID
        )
    
    return pending_update
