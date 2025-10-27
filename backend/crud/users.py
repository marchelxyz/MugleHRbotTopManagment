# backend/crud/users.py

from typing import Optional
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, or_
from sqlalchemy.orm import selectinload
import models
import schemas
from config import settings
from bot import send_telegram_message


async def get_user(db: AsyncSession, user_id: int):
    """Получить пользователя по ID"""
    result = await db.execute(select(models.User).where(models.User.id == user_id))
    return result.scalars().first()


async def get_user_by_telegram(db: AsyncSession, telegram_id: int):
    """Получить пользователя по Telegram ID"""
    result = await db.execute(select(models.User).where(models.User.telegram_id == telegram_id))
    return result.scalars().first()


async def create_user(db: AsyncSession, user: schemas.RegisterRequest):
    """Создать нового пользователя"""
    user_telegram_id = int(user.telegram_id)
    
    admin_ids_str = settings.TELEGRAM_ADMIN_IDS
    admin_ids = [int(id.strip()) for id in admin_ids_str.split(',')]
    is_admin = user_telegram_id in admin_ids
    
    dob = None
    if user.date_of_birth and user.date_of_birth.strip():
        try: 
            dob = date.fromisoformat(user.date_of_birth)
        except (ValueError, TypeError): 
            dob = None

    db_user = models.User(
        telegram_id=user_telegram_id,
        first_name=user.first_name,
        last_name=user.last_name,
        position=user.position,
        department=user.department,
        username=user.username,
        is_admin=is_admin,
        telegram_photo_url=user.telegram_photo_url,
        phone_number=user.phone_number,
        date_of_birth=dob,
        last_login_date=date.today()
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    
    try:
        user_info = (
            f"Новая заявка на регистрацию:\n\n"
            f"👤 **Имя:** {db_user.first_name} {db_user.last_name}\n"
            f"🏢 **Подразделение:** {db_user.department}\n"
            f"💼 **Должность:** {db_user.position}\n"
            f"📞 **Телефон:** {db_user.phone_number or 'не указан'}\n"
            f"🎂 **Дата рождения:** {db_user.date_of_birth or 'не указана'}\n"
            f"🆔 **Telegram ID:** {db_user.telegram_id}"
        )

        keyboard = {
            "inline_keyboard": [
                [
                    {"text": "✅ Принять", "callback_data": f"approve_{db_user.id}"},
                    {"text": "❌ Отказать", "callback_data": f"reject_{db_user.id}"}
                ]
            ]
        }
        
        await send_telegram_message(
            chat_id=settings.TELEGRAM_CHAT_ID,
            text=user_info,
            reply_markup=keyboard,
            message_thread_id=settings.TELEGRAM_ADMIN_TOPIC_ID
        )
    except Exception as e:
        print(f"FAILED to send admin notification. Error: {e}")
    
    return db_user


async def get_users(db: AsyncSession):
    """Получить всех пользователей"""
    result = await db.execute(select(models.User))
    return result.scalars().all()


async def update_user_profile(db: AsyncSession, user_id: int, data: schemas.UserUpdate):
    """Обновить профиль пользователя"""
    user = await get_user(db, user_id)
    if not user:
        return None
    
    update_data = data.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        if key == 'date_of_birth' and value:
            try:
                value = date.fromisoformat(value)
            except (ValueError, TypeError):
                value = None
        setattr(user, key, value)
        
    await db.commit()
    await db.refresh(user)
    return user


async def search_users_by_name(db: AsyncSession, query: str):
    """Поиск пользователей по имени"""
    if not query:
        return []
    
    search_query = f"%{query}%"
    
    result = await db.execute(
        select(models.User).filter(
            or_(
                models.User.first_name.ilike(search_query),
                models.User.last_name.ilike(search_query),
                models.User.username.ilike(search_query)
            )
        ).limit(20)
    )
    return result.scalars().all()


async def get_all_users_for_admin(db: AsyncSession):
    """Получить всех пользователей для админ-панели"""
    result = await db.execute(select(models.User).order_by(models.User.last_name))
    return result.scalars().all()


async def admin_update_user(db: AsyncSession, user_id: int, user_data: schemas.AdminUserUpdate, admin_user: models.User):
    """Обновить данные пользователя от имени администратора"""
    user = await get_user(db, user_id)
    if not user:
        return None
    
    update_data = user_data.model_dump(exclude_unset=True)
    changes_log = []

    for key, new_value in update_data.items():
        old_value = getattr(user, key, None)
        
        is_changed = False
        
        if isinstance(old_value, date):
            old_value_str = old_value.isoformat()
            if old_value_str != new_value:
                is_changed = True
        elif (old_value is None and new_value != "") or (new_value is None and old_value != ""):
            if str(old_value) != str(new_value):
                is_changed = True
        elif type(old_value) != type(new_value) and old_value is not None:
            try:
                if old_value != type(old_value)(new_value):
                    is_changed = True
            except (ValueError, TypeError):
                is_changed = True
        elif old_value != new_value:
            is_changed = True

        if is_changed:
            changes_log.append(f"  - {key}: `{old_value}` -> `{new_value}`")
        
        if key == 'date_of_birth' and new_value:
            try:
                setattr(user, key, date.fromisoformat(new_value))
            except (ValueError, TypeError):
                setattr(user, key, None)
        else:
            setattr(user, key, new_value)
    
    if changes_log:
        await db.commit()
        await db.refresh(user)

        admin_name = f"@{admin_user.username}" if admin_user.username else f"{admin_user.first_name} {admin_user.last_name}"
        target_user_name = f"@{user.username}" if user.username else f"{user.first_name} {user.last_name}"
        
        log_message = (
            f"✏️ *Админ изменил профиль*\n\n"
            f"👤 *Администратор:* {admin_name}\n"
            f"🎯 *Пользователь:* {target_user_name}\n\n"
            f"*Изменения:*\n" + "\n".join(changes_log)
        )
        
        await send_telegram_message(
            chat_id=settings.TELEGRAM_CHAT_ID,
            text=log_message,
            message_thread_id=settings.TELEGRAM_ADMIN_LOG_TOPIC_ID
        )

    return user


async def admin_delete_user(db: AsyncSession, user_id: int, admin_user: models.User):
    """Анонимизировать пользователя"""
    user_to_anonymize = await db.get(models.User, user_id)
    if not user_to_anonymize:
        return None
    if user_to_anonymize.id == admin_user.id:
        raise ValueError("Администратор не может удалить сам себя.")

    admin_name = f"{admin_user.first_name} {admin_user.last_name or ''}".strip()
    target_user_name = f"{user_to_anonymize.first_name} {user_to_anonymize.last_name or ''}".strip()

    user_to_anonymize.first_name = "Удаленный"
    user_to_anonymize.last_name = "Пользователь"
    user_to_anonymize.telegram_id = None
    user_to_anonymize.username = None
    user_to_anonymize.phone_number = None
    user_to_anonymize.telegram_photo_url = None
    user_to_anonymize.is_admin = False
    user_to_anonymize.status = "deleted"

    db.add(user_to_anonymize)
    await db.commit()

    log_message = (
        f"🗑️ *Админ анонимизировал пользователя*\n\n"
        f"👤 *Администратор:* {admin_name} (`{admin_user.id}`)\n"
        f"🎯 *Бывший пользователь:* {target_user_name} (`{user_id}`)\n\n"
        f"Личные данные пользователя стерты, история транзакций сохранена."
    )
    
    await send_telegram_message(
        chat_id=settings.TELEGRAM_CHAT_ID,
        text=log_message,
        message_thread_id=settings.TELEGRAM_ADMIN_LOG_TOPIC_ID
    )

    return user_to_anonymize


async def mark_onboarding_as_seen(db: AsyncSession, user_id: int):
    """Отметить, что пользователь прошел обучение"""
    user = await db.get(models.User, user_id)
    if user:
        user.has_seen_onboarding = True
        await db.commit()
        await db.refresh(user)
    return user
