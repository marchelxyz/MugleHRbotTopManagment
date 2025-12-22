import io
import zipfile
import json
import math 
import re
import logging
import traceback

import httpx
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select
import random
import bot
import config
from sqlalchemy.future import select
from sqlalchemy.orm import aliased
from sqlalchemy import select, func, update, delete, extract, and_
from sqlalchemy.ext.asyncio import AsyncSession
import models, schemas
from config import settings
from bot import send_telegram_message, escape_html
from database import settings
from unisender import unisender_client
from datetime import datetime, timedelta, date
from dateutil.relativedelta import relativedelta
from sqlalchemy import or_
from sqlalchemy import text
from sqlalchemy import select

logger = logging.getLogger(__name__)

# --- УТИЛИТЫ ДЛЯ РАБОТЫ С ПАРОЛЯМИ ---
def _get_password_context():
    """Создает и возвращает контекст для работы с паролями."""
    from passlib.context import CryptContext
    return CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    """
    Создает хеш пароля с обрезкой до 72 байт (ограничение bcrypt).
    
    Args:
        password: Пароль для хеширования
        
    Returns:
        Хеш пароля
    """
    # Bcrypt имеет ограничение на длину пароля в 72 байта
    # Обрезаем пароль до 72 байт перед хешированием
    if isinstance(password, str):
        password_bytes = password.encode('utf-8')
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
            password = password_bytes.decode('utf-8', errors='ignore')
    
    pwd_context = _get_password_context()
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Проверяет пароль с обрезкой до 72 байт (ограничение bcrypt).
    
    Args:
        plain_password: Пароль в открытом виде
        hashed_password: Хеш пароля для проверки
        
    Returns:
        True если пароль верный, False в противном случае
    """
    # Обрезаем пароль до 72 байт перед проверкой
    if isinstance(plain_password, str):
        password_bytes = plain_password.encode('utf-8')
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
            plain_password = password_bytes.decode('utf-8', errors='ignore')
    
    pwd_context = _get_password_context()
    return pwd_context.verify(plain_password, hashed_password)

# Пользователи
async def get_user(db: AsyncSession, user_id: int):
    result = await db.execute(select(models.User).where(models.User.id == user_id))
    user = result.scalars().first()
    if user:
        # Сбрасываем счетчик, если наступил новый день
        today = date.today()
        if user.last_login_date is None or user.last_login_date.date() < today:
            user.daily_transfer_count = 0
            user.last_login_date = datetime.utcnow()
            await db.commit()
            await db.refresh(user)
    return user

async def get_user_by_telegram(db: AsyncSession, telegram_id: int):
    # Игнорируем анонимизированных пользователей (telegram_id < 0)
    result = await db.execute(
        select(models.User).where(
            models.User.telegram_id == telegram_id,
            models.User.telegram_id >= 0
        )
    )
    user = result.scalars().first()
    if user:
        # Сбрасываем счетчик, если наступил новый день
        today = date.today()
        if user.last_login_date is None or user.last_login_date.date() < today:
            user.daily_transfer_count = 0
            user.last_login_date = datetime.utcnow()
            await db.commit()
            await db.refresh(user)
    return user

async def get_user_by_email(db: AsyncSession, email: str):
    """Получает пользователя по email."""
    if not email or not email.strip():
        return None
    result = await db.execute(
        select(models.User).where(models.User.email == email.strip().lower())
    )
    return result.scalar_one_or_none()

async def create_user(db: AsyncSession, user: schemas.RegisterRequest):
    # Для веб-формата telegram_id может быть None
    user_telegram_id = None
    is_admin = False
    
    if user.telegram_id:
        try:
            user_telegram_id = int(user.telegram_id)
            # Проверяем, что telegram_id не отрицательный (зарезервировано для анонимизированных пользователей)
            if user_telegram_id < 0:
                raise ValueError("telegram_id не может быть отрицательным (зарезервировано для анонимизированных пользователей)")
            
            admin_ids_str = settings.TELEGRAM_ADMIN_IDS
            admin_ids = [int(id.strip()) for id in admin_ids_str.split(',')]
            is_admin = user_telegram_id in admin_ids
        except (ValueError, TypeError):
            # Если telegram_id не число или None, оставляем его как None
            user_telegram_id = None
    
    # Проверяем, есть ли уже аккаунт с таким email (для мультиплатформенности)
    # Если пользователь регистрируется в Telegram и есть веб-аккаунт с таким email, связываем их
    existing_user_by_email = None
    if user.email and user.email.strip():
        existing_user_by_email = await get_user_by_email(db, user.email)
        if existing_user_by_email:
            # Если нашли существующий аккаунт с таким email
            if user_telegram_id:
                # Если пользователь регистрируется из Telegram
                if existing_user_by_email.telegram_id and existing_user_by_email.telegram_id >= 0:
                    # Аккаунт уже связан с другим Telegram ID
                    raise ValueError(f"Аккаунт с email {user.email} уже связан с другим Telegram-аккаунтом")
                # Связываем Telegram ID с существующим веб-аккаунтом
                existing_user_by_email.telegram_id = user_telegram_id
                existing_user_by_email.username = user.username or existing_user_by_email.username
                existing_user_by_email.telegram_photo_url = user.telegram_photo_url or existing_user_by_email.telegram_photo_url
                # Обновляем is_admin, если нужно
                if is_admin:
                    existing_user_by_email.is_admin = True
                await db.commit()
                await db.refresh(existing_user_by_email)
                return existing_user_by_email
            else:
                # Если пользователь регистрируется из веб, но email уже занят
                raise ValueError(f"Аккаунт с email {user.email} уже существует")
    
    dob = None
    if user.date_of_birth and user.date_of_birth.strip():
        try: dob = date.fromisoformat(user.date_of_birth)
        except (ValueError, TypeError): dob = None

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
        email=user.email.strip().lower() if user.email and user.email.strip() else None,  # Сохраняем email в нижнем регистре
        last_login_date=date.today()
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    
    # Отправляем email уведомление администраторам при регистрации через веб
    if not user_telegram_id and db_user.email:
        try:
            registration_date_str = db_user.registration_date.strftime('%Y-%m-%d %H:%M') if db_user.registration_date else 'не указана'
            await unisender_client.send_registration_notification(
                user_email=db_user.email,
                first_name=db_user.first_name or '',
                last_name=db_user.last_name or '',
                position=db_user.position or '',
                department=db_user.department or '',
                phone_number=db_user.phone_number or '',
                registration_date=registration_date_str
            )
        except Exception as e:
            logger.error(f"Ошибка при отправке email уведомления о регистрации: {e}")
    
    # Отправляем уведомление администраторам только если есть TELEGRAM_CHAT_ID
    try:
        if settings.TELEGRAM_CHAT_ID:
            user_info = (
                f"Новая заявка на регистрацию:\n\n"
                f"👤 Имя: {db_user.first_name or ''} {db_user.last_name or ''}\n"
                f"🏢 Подразделение: {db_user.department or ''}\n"
                f"💼 Должность: {db_user.position or ''}\n"
                f"📞 Телефон: {db_user.phone_number or 'не указан'}\n"
                f"🎂 Дата рождения: {str(db_user.date_of_birth) if db_user.date_of_birth else 'не указана'}\n"
                f"🆔 Telegram ID: {db_user.telegram_id or 'не указан (веб-регистрация)'}"
            )

            # --- ИСПРАВЛЕННАЯ СТРУКТУРА КНОПОК ---
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
                message_thread_id=settings.TELEGRAM_ADMIN_TOPIC_ID,
                parse_mode=None
            )
    except Exception as e:
        print(f"FAILED to send admin notification. Error: {e}")
    
    return db_user

async def get_users(db: AsyncSession):
    result = await db.execute(
        select(models.User).where(
            and_(
                models.User.status != 'deleted',
                models.User.status != 'rejected'
            )
        )
    )
    return result.scalars().all()

async def update_user_profile(db: AsyncSession, user_id: int, data: schemas.UserUpdate):
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

# Транзакции
async def create_transaction(db: AsyncSession, tr: schemas.TransferRequest):
    today = date.today()
    sender = await db.get(models.User, tr.sender_id)
    if not sender:
        raise ValueError("Отправитель не найден")

    # Обновляем счетчик, если наступил новый день
    # --- ИСПРАВЛЕНИЕ ЗДЕСЬ ---
    # Обновляем счетчик, если наступил новый день
    # Сравниваем дату с датой, добавляя .date()
    if sender.last_login_date is None or sender.last_login_date.date() < today:
        sender.daily_transfer_count = 0
    
    # Записываем текущее время в last_login_date, так как колонка теперь DateTime
    sender.last_login_date = datetime.utcnow()
    
    fixed_amount = 1 
    if sender.daily_transfer_count >= 3:
        raise ValueError("Дневной лимит переводов исчерпан (3 в день)")

    receiver = await db.get(models.User, tr.receiver_id)
    if not receiver:
        raise ValueError("Получатель не найден")
    
    sender.daily_transfer_count += 1
    receiver.balance += fixed_amount
    sender.ticket_parts += 1
    
    db_tr = models.Transaction(
        sender_id=tr.sender_id,
        receiver_id=tr.receiver_id,
        amount=fixed_amount,
        message=tr.message
    )
    db.add(db_tr)
    await db.commit()
    await db.refresh(sender) # Обновляем данные отправителя из БД
    
    try:
        message_text = (f"🎉 Вам начислена <b>1</b> спасибка!\n"
                        f"От: <b>{escape_html(sender.first_name or '')} {escape_html(sender.last_name or '')}</b>\n"
                        f"Сообщение: <i>{escape_html(tr.message or '')}</i>")
        # Игнорируем анонимизированных пользователей (telegram_id < 0)
        if receiver.telegram_id and receiver.telegram_id >= 0:
            await send_telegram_message(chat_id=receiver.telegram_id, text=message_text)
    except Exception as e:
        print(f"Could not send notification to user {receiver.telegram_id}. Error: {e}")
    
    # --- ГЛАВНОЕ ИЗМЕНЕНИЕ: Возвращаем обновленного отправителя ---
    return sender
    
# crud.py

async def get_feed(db: AsyncSession):
    """
    Получает ленту транзакций, гарантируя, что отправитель и получатель существуют.
    """
    Sender = aliased(models.User, name='sender_user')
    Receiver = aliased(models.User, name='receiver_user')

    stmt = (
        select(models.Transaction)
        .join(Sender, models.Transaction.sender_id == Sender.id)
        .join(Receiver, models.Transaction.receiver_id == Receiver.id)
        .order_by(models.Transaction.timestamp.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()

async def get_user_transactions(db: AsyncSession, user_id: int):
    """
    Получает транзакции пользователя, гарантируя, что второй участник транзакции существует.
    """
    Sender = aliased(models.User, name='sender_user')
    Receiver = aliased(models.User, name='receiver_user')

    stmt = (
        select(models.Transaction)
        .join(Sender, models.Transaction.sender_id == Sender.id)
        .join(Receiver, models.Transaction.receiver_id == Receiver.id)
        .where((models.Transaction.sender_id == user_id) | (models.Transaction.receiver_id == user_id))
        .order_by(models.Transaction.timestamp.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()

# Лидерборд
async def get_leaderboard_data(db: AsyncSession, period: str, leaderboard_type: str):
    """
    Универсальная функция для получения данных рейтинга.
    :param period: 'current_month', 'last_month', 'all_time'
    :param leaderboard_type: 'received' (получатели) или 'sent' (отправители)
    """
    
    # Определяем, по какому полю группировать
    group_by_field = "receiver_id" if leaderboard_type == 'received' else "sender_id"
    
    # Определяем временной промежуток
    start_date, end_date = None, None
    today = datetime.utcnow()
    
    if period == 'current_month':
        start_date = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_date = today
    elif period == 'last_month':
        first_day_current_month = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_date = first_day_current_month - timedelta(days=1)
        start_date = end_date.replace(day=1)
        end_date = end_date.replace(hour=23, minute=59, second=59) # Включаем весь последний день

    # Формируем запрос
    query = (
        select(
            models.User,
            func.sum(models.Transaction.amount).label("total_amount"),
        )
        .join(models.Transaction, models.User.id == getattr(models.Transaction, group_by_field))
        .where(models.User.status != 'deleted')  # Исключаем анонимизированных пользователей
        .group_by(models.User.id)
        .order_by(func.sum(models.Transaction.amount).desc())
        .limit(100) # Ограничим вывод до 100 лидеров
    )
    
    if start_date and end_date:
        query = query.where(models.Transaction.timestamp.between(start_date, end_date))

    result = await db.execute(query)
    leaderboard_data = result.all()

    # Pydantic ожидает total_received, адаптируем ответ
    return [{"user": user, "total_received": total_amount or 0} for user, total_amount in leaderboard_data]


async def get_user_rank(db: AsyncSession, user_id: int, period: str, leaderboard_type: str):
    """
    Определяет ранг, количество очков и общее число участников для конкретного пользователя.
    """
    group_by_field = "receiver_id" if leaderboard_type == 'received' else "sender_id"
    
    start_date, end_date = None, None
    today = datetime.utcnow()
    
    if period == 'current_month':
        start_date = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_date = today
    elif period == 'last_month':
        first_day_current_month = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_date = first_day_current_month - timedelta(days=1)
        start_date = end_date.replace(day=1)
        end_date = end_date.replace(hour=23, minute=59, second=59)

    time_filter = ""
    if start_date and end_date:
        # Форматируем даты для SQL-запроса
        start_str = start_date.strftime('%Y-%m-%d %H:%M:%S')
        end_str = end_date.strftime('%Y-%m-%d %H:%M:%S')
        time_filter = f"AND t.timestamp BETWEEN '{start_str}' AND '{end_str}'"

    # --- НАЧАЛО ИСПРАВЛЕНИЙ ---
    raw_sql = text(f"""
        WITH ranked_users AS (
            SELECT
                u.id as user_id,
                SUM(t.amount) as total_amount,
                RANK() OVER (ORDER BY SUM(t.amount) DESC) as rank
            FROM users u
            JOIN transactions t ON u.id = t.{group_by_field}
            WHERE u.status != 'deleted'
            {time_filter}
            GROUP BY u.id
        ),
        total_participants AS (
            SELECT COUNT(DISTINCT t.{group_by_field}) as count 
            FROM transactions t
            JOIN users u ON u.id = t.{group_by_field}
            WHERE u.status != 'deleted'
            {time_filter}
        )
        SELECT ru.rank, ru.total_amount, tp.count
        FROM ranked_users ru, total_participants tp
        WHERE ru.user_id = :user_id
    """)
    # --- КОНЕЦ ИСПРАВЛЕНИЙ ---

    result = await db.execute(raw_sql, {"user_id": user_id})
    user_rank_data = result.first()

    if not user_rank_data:
        time_filter_for_count = ""
        if start_date and end_date:
            start_str = start_date.strftime('%Y-%m-%d %H:%M:%S')
            end_str = end_date.strftime('%Y-%m-%d %H:%M:%S')
            time_filter_for_count = f"AND t.timestamp BETWEEN '{start_str}' AND '{end_str}'"
        
        total_participants_sql = text(f"""
            SELECT COUNT(DISTINCT t.{group_by_field}) as count 
            FROM transactions t
            JOIN users u ON u.id = t.{group_by_field}
            WHERE u.status != 'deleted'
            {time_filter_for_count}
        """)
        total_result = await db.execute(total_participants_sql)
        total_participants = total_result.scalar_one_or_none() or 0
        return {"rank": None, "total_received": 0, "total_participants": total_participants}

    return {
        "rank": user_rank_data.rank,
        "total_received": user_rank_data.total_amount,
        "total_participants": user_rank_data.count
    }

# Маркет
async def get_market_items(db: AsyncSession):
    # Теперь можно просто вернуть объекты SQLAlchemy,
    # Pydantic сам преобразует их согласно response_model в роутере.
    result = await db.execute(
        select(models.MarketItem)
        .options(selectinload(models.MarketItem.codes))
    )
    return result.scalars().all()

async def get_active_items(db: AsyncSession):
    """Возвращает список всех активных товаров с корректно посчитанным остатком."""
    
    # 1. Запрашиваем все товары И сразу же подгружаем связанные с ними коды
    result = await db.execute(
        select(models.MarketItem)
        .where(models.MarketItem.is_archived == False)
        .options(selectinload(models.MarketItem.codes)) 
    )
    items = result.scalars().unique().all()
    
    # 2. Теперь считаем остаток в коде, а не в базе
    for item in items:
        if item.is_auto_issuance:
            # Считаем только НЕвыданные коды
            available_codes = sum(1 for code in item.codes if not code.is_issued)
            item.stock = available_codes
        elif item.is_local_purchase:
            # Для локальных покупок остаток берем из базы данных (они не используют коды)
            # Если остаток не установлен или равен 0, устанавливаем его в большое значение
            # чтобы товар всегда был доступен для покупки
            # Но если остаток установлен и больше 0, используем его
            if item.stock is None or item.stock <= 0:
                item.stock = 999999  # Неограниченный остаток для локальных покупок по умолчанию
            # Иначе используем значение из базы данных
            
    return items
    
async def create_market_item(db: AsyncSession, item: schemas.MarketItemCreate):
    db_item = models.MarketItem(**item.model_dump())
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    
    return {
        "id": db_item.id, "name": db_item.name, "description": db_item.description,
        "price": db_item.price, "stock": db_item.stock,
    }
    
# --- Функция восстановления товара ---

async def admin_restore_market_item(db: AsyncSession, item_id: int):
    """Восстанавливает товар из архива."""
    # Находим товар по его ID с загрузкой связанных кодов
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(models.MarketItem)
        .options(selectinload(models.MarketItem.codes))
        .where(models.MarketItem.id == item_id)
    )
    db_item = result.scalar_one_or_none()
    
    if not db_item:
        # Если товар не найден, выходим
        return None
    
    # Меняем флаг "is_archived" обратно на False
    db_item.is_archived = False
    
    # Сохраняем изменения в базе данных
    await db.commit()
    await db.refresh(db_item)
    
    # Возвращаем восстановленный товар
    return db_item

# --- КОНЕЦ БЛОКА ---

async def create_purchase(db: AsyncSession, pr: schemas.PurchaseRequest):
    issued_code_value = None
    item = await db.get(models.MarketItem, pr.item_id)
    result = await db.execute(
        select(models.User).where(models.User.telegram_id == pr.user_id)
    )
    user = result.scalar_one_or_none()

    if not item or not user:
        raise ValueError("Товар или пользователь не найдены")
    if user.balance < item.price:
        raise ValueError("Недостаточно средств")
    
    # Проверяем, что товар не является совместным подарком
    if item.is_shared_gift:
        raise ValueError("Для совместных подарков используйте специальный API")
    
    # Проверяем, что товар не является локальным подарком
    if item.is_local_purchase:
        raise ValueError("Для локальных покупок используйте специальный API")

    if item.is_auto_issuance:
        # Используем with_for_update(skip_locked=True) для предотвращения блокировок
        stmt = (
            select(models.ItemCode)
            .where(models.ItemCode.market_item_id == item.id, models.ItemCode.is_issued == False)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        result = await db.execute(stmt)
        code_to_issue = result.scalars().first()
        if not code_to_issue:
            raise ValueError("Товар закончился (нет доступных кодов)")
        user.balance -= item.price
        code_to_issue.is_issued = True
        code_to_issue.issued_to_user_id = user.id
        issued_code_value = code_to_issue.code_value
    else:
        if item.stock <= 0:
            raise ValueError("Товар закончился")
        user.balance -= item.price
        item.stock -= 1

    db_purchase = models.Purchase(user_id=user.id, item_id=pr.item_id)
    db.add(db_purchase)
    if 'code_to_issue' in locals() and code_to_issue:
        await db.flush()
        code_to_issue.purchase_id = db_purchase.id

    # Сохраняем данные перед отправкой уведомлений
    await db.commit()
    
    # Сохраняем данные для уведомлений перед отправкой
    item_name = item.name
    user_telegram_id = user.telegram_id
    user_first_name = user.first_name
    user_username = user.username
    user_position = user.position
    user_phone_number = user.phone_number
    user_email = user.email
    user_balance = user.balance
    item_price = item.price

    # --- ФИНАЛЬНАЯ ВЕРСИЯ УВЕДОМЛЕНИЙ ---
    # Отправляем уведомления ПОСЛЕ commit, чтобы не блокировать транзакцию
    try:
        # Уведомление для администратора
        admin_message = (
            f"🛍️ <b>Новая покупка в магазине!</b>\n\n"
            f"👤 <b>Пользователь:</b> {escape_html(user_first_name or '')} (@{escape_html(user_username or str(user_telegram_id))})\n"
            f"📞 <b>Телефон:</b> {escape_html(user_phone_number or 'не указан')}\n"
        )
        if user_email:
            admin_message += f"📧 <b>Почта:</b> {escape_html(user_email)}\n"
        admin_message += (
            f"💼 <b>Должность:</b> {escape_html(user_position or '')}\n\n"
            f"🎁 <b>Товар:</b> {escape_html(item_name)}\n"
            f"💰 <b>Стоимость:</b> {item_price} спасибок"
        )
        if issued_code_value:
            admin_message += (
                f"\n\n✨ <b>Товар с автовыдачей</b>\n"
                f"🔑 <b>Выданный код:</b> <code>{escape_html(issued_code_value)}</code>"
            )
        admin_message += f"\n\n📉 <b>Новый баланс пользователя:</b> {user_balance} спасибок"
        
        await send_telegram_message(
            chat_id=settings.TELEGRAM_CHAT_ID,
            text=admin_message,
            message_thread_id=settings.TELEGRAM_PURCHASE_TOPIC_ID
        )

        # Уведомление для пользователя (теперь для всех покупок)
        user_message = f"🎉 Поздравляем с покупкой \"{escape_html(item_name)}\"!"
        if issued_code_value:
            # Для товаров с кодом добавляем сам код
            user_message += f"\n\nВаш уникальный код/ссылка:\n<code>{escape_html(issued_code_value)}</code>"
        
        await send_telegram_message(chat_id=user_telegram_id, text=user_message)

    except Exception as e:
        print(f"Could not send notification. Error: {e}")
    
    return {"new_balance": user.balance, "issued_code": issued_code_value}

async def create_local_gift(db: AsyncSession, pr: schemas.LocalGiftRequest):
    """Создает локальный подарок с резервированием спасибок"""
    item = await db.get(models.MarketItem, pr.item_id)
    result = await db.execute(
        select(models.User).where(models.User.telegram_id == pr.user_id)
    )
    user = result.scalar_one_or_none()

    if not item or not user:
        raise ValueError("Товар или пользователь не найдены")
    
    if not item.is_local_purchase:
        raise ValueError("Этот товар не является локальным подарком")
    
    # Проверяем доступный баланс (баланс - зарезервированные средства)
    available_balance = user.balance - (user.reserved_balance or 0)
    if available_balance < item.price:
        raise ValueError("Недостаточно средств")
    
    # Резервируем спасибки
    if user.reserved_balance is None:
        user.reserved_balance = 0
    user.reserved_balance += item.price
    
    # Создаем запись о покупке
    db_purchase = models.Purchase(user_id=user.id, item_id=pr.item_id)
    db.add(db_purchase)
    await db.flush()  # Получаем ID покупки
    
    # Создаем запись о локальном подарке
    local_purchase = models.LocalGift(
        user_id=user.id,
        item_id=pr.item_id,
        purchase_id=db_purchase.id,
        city=pr.city,
        website_url=pr.website_url,
        status='pending',
        reserved_amount=item.price
    )
    db.add(local_purchase)
    await db.flush()
    
    # Отправляем уведомление администраторам
    try:
        admin_message = (
            f"🛍️ <b>Новый локальный подарок!</b>\n\n"
            f"👤 <b>Пользователь:</b> {escape_html(user.first_name or '')} {escape_html(user.last_name or '')}\n"
            f"📱 <b>Telegram:</b> @{escape_html(user.username or str(user.telegram_id))}\n"
            f"📞 <b>Телефон:</b> {escape_html(user.phone_number or 'не указан')}\n"
        )
        if user.email:
            admin_message += f"📧 <b>Почта:</b> {escape_html(user.email)}\n"
        admin_message += (
            f"💼 <b>Должность:</b> {escape_html(user.position or '')}\n"
            f"🏢 <b>Подразделение:</b> {escape_html(user.department or '')}\n\n"
            f"🎁 <b>Товар:</b> {escape_html(item.name)}\n"
            f"💰 <b>Стоимость:</b> {item.price} спасибок\n"
            f"🏙️ <b>Город:</b> {escape_html(pr.city)}\n"
            f"🔗 <b>Ссылка:</b> {escape_html(pr.website_url)}\n\n"
            f"📉 <b>Баланс пользователя:</b> {user.balance} спасибок\n"
            f"🔒 <b>Зарезервировано:</b> {user.reserved_balance} спасибок"
        )
        
        reply_markup = {
            "inline_keyboard": [
                [
                    {
                        "text": "✅ Принять",
                        "callback_data": f"approve_local_purchase_{local_purchase.id}"
                    },
                    {
                        "text": "❌ Отказать",
                        "callback_data": f"reject_local_purchase_{local_purchase.id}"
                    }
                ]
            ]
        }
        
        await send_telegram_message(
            chat_id=settings.TELEGRAM_CHAT_ID,
            text=admin_message,
            reply_markup=reply_markup,
            message_thread_id=settings.TELEGRAM_PURCHASE_TOPIC_ID
        )
    except Exception as e:
        print(f"Could not send admin notification. Error: {e}")
    
    # Отправляем уведомление пользователю
    try:
        user_message = (
            f"🛍️ <b>Ваша заявка на локальный подарок принята!</b>\n\n"
            f"🎁 <b>Товар:</b> {escape_html(item.name)}\n"
            f"🏙️ <b>Город:</b> {escape_html(pr.city)}\n"
            f"🔗 <b>Ссылка:</b> {escape_html(pr.website_url)}\n\n"
            f"💰 <b>Зарезервировано:</b> {item.price} спасибок\n\n"
            f"⏳ Ожидайте решения администратора"
        )
        
        if user.telegram_id and user.telegram_id >= 0:
            await send_telegram_message(chat_id=user.telegram_id, text=user_message)
    except Exception as e:
        print(f"Could not send user notification. Error: {e}")

    await db.commit()
    
    return {
        "new_balance": user.balance,
        "reserved_balance": user.reserved_balance,
        "local_purchase_id": local_purchase.id
    }

async def process_local_gift_approval(db: AsyncSession, local_purchase_id: int, action: str):
    """Обрабатывает принятие или отказ в локальном подарке"""
    local_purchase = await db.get(models.LocalGift, local_purchase_id)
    if not local_purchase:
        raise ValueError("Локальный подарок не найден")
    
    if local_purchase.status != 'pending':
        return None  # Уже обработано
    
    user = await db.get(models.User, local_purchase.user_id)
    item = await db.get(models.MarketItem, local_purchase.item_id)
    
    if not user or not item:
        raise ValueError("Пользователь или товар не найдены")
    
    if action == 'approve':
        # Списываем зарезервированные спасибки
        if user.reserved_balance is None:
            user.reserved_balance = 0
        user.reserved_balance -= local_purchase.reserved_amount
        user.balance -= local_purchase.reserved_amount
        local_purchase.status = 'approved'
        
        # Уведомление пользователю
        user_message = (
            f"✅ <b>Ваш локальный подарок одобрен!</b>\n\n"
            f"🎁 <b>Товар:</b> {escape_html(item.name)}\n"
            f"💰 <b>Списано:</b> {local_purchase.reserved_amount} спасибок\n\n"
            f"📉 <b>Ваш баланс:</b> {user.balance} спасибок"
        )
        
    elif action == 'reject':
        # Возвращаем зарезервированные спасибки (не списываем баланс)
        if user.reserved_balance is None:
            user.reserved_balance = 0
        user.reserved_balance -= local_purchase.reserved_amount
        local_purchase.status = 'rejected'
        
        # Уведомление пользователю
        user_message = (
            f"❌ <b>Ваш локальный подарок отклонен</b>\n\n"
            f"🎁 <b>Товар:</b> {escape_html(item.name)}\n"
            f"💰 <b>Возвращено:</b> {local_purchase.reserved_amount} спасибок\n\n"
            f"📉 <b>Ваш баланс:</b> {user.balance} спасибок\n"
            f"🔒 <b>Зарезервировано:</b> {user.reserved_balance} спасибок"
        )
    else:
        raise ValueError("Неверное действие")
    
    local_purchase.updated_at = datetime.utcnow()
    await db.commit()
    
    # Отправляем уведомление пользователю
    try:
        if user.telegram_id and user.telegram_id >= 0:
            await send_telegram_message(chat_id=user.telegram_id, text=user_message)
    except Exception as e:
        print(f"Could not send user notification. Error: {e}")
    
    return {"status": local_purchase.status, "user_balance": user.balance, "reserved_balance": user.reserved_balance}
    
# Админ
async def add_points_to_all_users(db: AsyncSession, amount: int):
    await db.execute(update(models.User).values(balance=models.User.balance + amount))
    await db.commit()
    return True

# --- НАЧАЛО ИЗМЕНЕНИЙ: Добавляем новую функцию ---
async def add_tickets_to_all_users(db: AsyncSession, amount: int):
    """Начисляет указанное количество билетов для рулетки всем пользователям."""
    await db.execute(update(models.User).values(tickets=models.User.tickets + amount))
    await db.commit()
    return True
# --- КОНЕЦ ИЗМЕНЕНИЙ ---

async def reset_balances(db: AsyncSession):
    await db.execute(update(models.User).values(balance=0))
    await db.commit()
    return True

# --- CRUD ДЛЯ БАННЕРОВ ---

async def get_active_banners(db: AsyncSession):
    """Получает все активные баннеры."""
    result = await db.execute(
        select(models.Banner).where(models.Banner.is_active == True)
    )
    return result.scalars().all()

async def get_all_banners(db: AsyncSession):
    """Получает абсолютно все баннеры (для админки)."""
    result = await db.execute(select(models.Banner))
    return result.scalars().all()

async def create_banner(db: AsyncSession, banner: schemas.BannerCreate):
    """Создает новый баннер."""
    db_banner = models.Banner(**banner.model_dump())
    db.add(db_banner)
    await db.commit()
    await db.refresh(db_banner)
    return db_banner

async def update_banner(db: AsyncSession, banner_id: int, banner_data: schemas.BannerUpdate):
    """Обновляет баннер."""
    result = await db.execute(select(models.Banner).where(models.Banner.id == banner_id))
    db_banner = result.scalars().first()
    if not db_banner:
        return None
    
    for key, value in banner_data.model_dump(exclude_unset=True).items():
        setattr(db_banner, key, value)
        
    await db.commit()
    await db.refresh(db_banner)
    return db_banner

async def delete_banner(db: AsyncSession, banner_id: int):
    """Удаляет баннер."""
    result = await db.execute(select(models.Banner).where(models.Banner.id == banner_id))
    db_banner = result.scalars().first()
    if db_banner:
        await db.delete(db_banner)
        await db.commit()
        return True
    return False

# --- НОВЫЕ ФУНКЦИИ ДЛЯ АВТОМАТИЗАЦИИ ---
async def process_birthday_bonuses(db: AsyncSession):
    """Начисляет 15 баллов всем, у кого сегодня день рождения и отправляет поздравительное сообщение."""
    today = date.today()
    users_with_birthday = await db.execute(
        select(models.User).where(
            func.extract('month', models.User.date_of_birth) == today.month,
            func.extract('day', models.User.date_of_birth) == today.day
        )
    )
    users = users_with_birthday.scalars().all()
    
    for user in users:
        user.balance += 15
        
        # Отправляем поздравительное сообщение в Telegram
        # Игнорируем анонимизированных пользователей (telegram_id < 0)
        if user.telegram_id and user.telegram_id >= 0 and user.status == "approved":
            birthday_message = (
                f"🎉 <b>С Днем Рождения!</b> 🎂\n\n"
                f"Дорогой/ая <b>{escape_html(user.first_name or 'коллега')}</b>, поздравляем вас с днем рождения!\n\n"
                f"🎁 В честь этого праздника вам начислено <b>15 спасибок</b> в качестве подарка!\n\n"
                f"Желаем вам здоровья, счастья и успехов во всех начинаниях! 🎈"
            )
            try:
                await send_telegram_message(user.telegram_id, birthday_message)
            except Exception as e:
                logger.error(f"Не удалось отправить поздравление пользователю {user.id}: {e}")
    
    # --- ДОБАВИТЬ ЭТИ ДВЕ СТРОКИ ---
    await reset_ticket_parts(db)
    await reset_tickets(db)
    
    await db.commit()
    return len(users)

# --- ДОБАВЬТЕ ЭТУ НОВУЮ ФУНКЦИЮ В КОНЕЦ ФАЙЛА ---
async def _ensure_unique_login(db: AsyncSession, base_login: str, exclude_user_id: int) -> str:
    """
    Проверяет уникальность логина и добавляет суффикс, если логин уже занят.
    """
    login = base_login
    counter = 1
    
    while True:
        result = await db.execute(
            select(models.User).where(
                models.User.login == login,
                models.User.id != exclude_user_id
            )
        )
        existing_user = result.scalar_one_or_none()
        
        if not existing_user:
            return login
        
        # Если логин занят, добавляем суффикс
        login = f"{base_login}{counter}"
        counter += 1

async def update_user_status(db: AsyncSession, user_id: int, status: str):
    """
    Обновляет статус пользователя.
    При одобрении веб-пользователей автоматически генерирует логин и пароль.
    """
    result = await db.execute(select(models.User).where(models.User.id == user_id))
    user = result.scalars().first()
    if not user:
        return None
    
    generated_login = None
    generated_password = None
    
    # Если статус меняется на 'approved' и это веб-пользователь (нет telegram_id или telegram_id < 0)
    if status == 'approved' and (user.telegram_id is None or user.telegram_id < 0):
        # Генерируем логин, если его еще нет
        login_was_generated = False
        if not user.login:
            base_login = generate_login_from_name(user.first_name, user.last_name, user.id)
            generated_login = await _ensure_unique_login(db, base_login, user.id)
            user.login = generated_login
            login_was_generated = True
        
        # Генерируем пароль, если его еще нет
        password_was_generated = False
        if not user.password_hash:
            generated_password = generate_random_password(12)
            user.password_hash = get_password_hash(generated_password)
            password_was_generated = True
        
        # Включаем возможность входа через браузер
        user.browser_auth_enabled = True
        
        # Сохраняем флаги генерации для возврата в ответе
        user._login_was_generated = login_was_generated
        user._password_was_generated = password_was_generated
    
    user.status = status
    await db.commit()
    await db.refresh(user)
    
    # Если были сгенерированы новые учетные данные, сохраняем их в объекте пользователя
    # для возврата в ответе (временное поле, не сохраняется в БД)
    if hasattr(user, '_login_was_generated') or hasattr(user, '_password_was_generated'):
        if hasattr(user, '_login_was_generated') and user._login_was_generated:
            user._generated_login = user.login
        if hasattr(user, '_password_was_generated') and user._password_was_generated and generated_password:
            user._generated_password = generated_password
    
    # Отправляем email с учетными данными при одобрении веб-пользователя
    if status == 'approved' and (user.telegram_id is None or user.telegram_id < 0) and user.email:
        # Проверяем, были ли сгенерированы учетные данные
        credentials_generated = (
            hasattr(user, '_login_was_generated') and user._login_was_generated and
            hasattr(user, '_password_was_generated') and user._password_was_generated
        )
        
        # Отправляем email только если были сгенерированы новые учетные данные
        if credentials_generated and user._generated_login and user._generated_password:
            try:
                await unisender_client.send_credentials_email(
                    email=user.email,
                    first_name=user.first_name or '',
                    last_name=user.last_name or '',
                    login=user._generated_login,
                    password=user._generated_password
                )
                logger.info(f"Email с учетными данными отправлен на {user.email}")
            except Exception as e:
                logger.error(f"Ошибка при отправке email с учетными данными на {user.email}: {e}")
    
    return user

# --- ИЗМЕНЕНИЕ: Новая, простая формула расчета цены ---
def calculate_spasibki_price(price_rub: int) -> int:
    """Рассчитывает стоимость в 'спасибках' по курсу 50 рублей за 1 спасибку."""
    if price_rub <= 0:
        return 0
    return round(price_rub / 30)

def calculate_accumulation_forecast(price_spasibki: int) -> str:
    """Рассчитывает примерный прогноз накопления."""
    # Это очень упрощенная модель, основанная на ваших примерах.
    # Предполагаем, что средний пользователь получает около 1000 спасибок в месяц.
    months_needed = price_spasibki / 50
    
    if months_needed <= 1:
        return "около 1 месяца"
    elif months_needed <= 18: # до 1.5 лет
        return f"около {round(months_needed)} мес."
    else:
        years = round(months_needed / 12, 1)
        return f"около {years} лет"

# Мы переименуем старую функцию create_market_item
async def admin_create_market_item(db: AsyncSession, item: schemas.MarketItemCreate):
    calculated_price = item.price_rub // 30
    
    codes = []
    if item.is_auto_issuance and item.item_codes: # Проверяем правильное поле из схемы
        codes = [code.strip() for code in item.item_codes if code.strip()]
        stock = len(codes)
    else:
        stock = item.stock

    db_item = models.MarketItem(
        name=item.name,
        description=item.description,
        price=calculated_price, 
        price_rub=item.price_rub,
        stock=stock,
        image_url=item.image_url,
        original_price=item.original_price,
        is_auto_issuance=item.is_auto_issuance,
        is_shared_gift=item.is_shared_gift,
        is_local_purchase=item.is_local_purchase
    )
    
    # Сначала добавляем основной товар в сессию, чтобы он получил ID
    db.add(db_item)
    await db.flush() # Это важно, чтобы db_item.id стал доступен

    # Теперь создаем коды, связанные с этим ID
    if codes:
        for code_value in codes:
            # Используем db_item.id напрямую
            db_code = models.ItemCode(code_value=code_value, market_item_id=db_item.id)
            db.add(db_code)

    await db.commit()

    # --- ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ ---
    # После сохранения, заново запрашиваем товар из базы,
    # но на этот раз сразу же подгружаем все связанные с ним коды.
    result = await db.execute(
        select(models.MarketItem)
        .where(models.MarketItem.id == db_item.id)
        .options(selectinload(models.MarketItem.codes))
    )
    created_item_with_codes = result.scalar_one_or_none()
    
    # Возвращаем полностью загруженный объект
    return created_item_with_codes

async def admin_update_market_item(db: AsyncSession, item_id: int, item_data: schemas.MarketItemUpdate):
    print(f"--- [UPDATE ITEM {item_id}] Начало обновления ---") # <-- Лог 1
    print(f"Полученные данные item_data: {item_data.model_dump(exclude_unset=True)}") # <-- Лог 2

    db_item = await db.get(models.MarketItem, item_id)
    if not db_item:
        print(f"--- [UPDATE ITEM {item_id}] ОШИБКА: Товар не найден ---") # <-- Лог ошибки
        return None

    print(f"Текущие данные товара ДО обновления: name='{db_item.name}', price={db_item.price}, stock={db_item.stock}, price_rub={db_item.price_rub}, original_price={db_item.original_price}") # <-- Лог 3 (Добавил больше полей)

    # Обновляем основные данные товара
    update_data = item_data.model_dump(exclude_unset=True)
    updated_fields_count = 0 # Счетчик реальных изменений
    for key, value in update_data.items():
        # Исключаем поля, которые обрабатываются отдельно
        if key not in ["added_stock", "new_item_codes"]:
            # Проверяем, существует ли поле в модели и изменилось ли значение
            if hasattr(db_item, key) and getattr(db_item, key) != value:
                 print(f"--- [UPDATE ITEM {item_id}] Обновляем поле '{key}': '{getattr(db_item, key)}' -> '{value}' ---") # <-- Лог 3.1
                 setattr(db_item, key, value)
                 updated_fields_count += 1

    # Логика для обычных товаров
    stock_changed = False
    if not db_item.is_auto_issuance and item_data.added_stock is not None and item_data.added_stock > 0:
        print(f"--- [UPDATE ITEM {item_id}] Добавляем к стоку обычного товара: {item_data.added_stock} ---") # <-- Лог 4a
        db_item.stock += item_data.added_stock
        stock_changed = True
        updated_fields_count += 1


    # Логика для автовыдачи
    new_codes_added = False
    added_code_values = [] # Список для лога
    if db_item.is_auto_issuance and item_data.new_item_codes:
        print(f"--- [UPDATE ITEM {item_id}] Получены новые коды для добавления: {len(item_data.new_item_codes)} шт. ---") # <-- Лог 4b
        for code_value in item_data.new_item_codes:
            stripped_code = code_value.strip()
            if stripped_code:
                new_code = models.ItemCode(code_value=stripped_code, market_item_id=db_item.id)
                db.add(new_code)
                added_code_values.append(stripped_code) # Собираем для лога
                new_codes_added = True

        if new_codes_added:
            print(f"--- [UPDATE ITEM {item_id}] Подготовлены к добавлению коды: {added_code_values} ---") # <-- Лог 4c
            await db.flush() # Сохраняем коды, чтобы обновить сток
            # Пересчитываем сток на основе ВСЕХ кодов (не только невыданных)
            current_codes_count = await db.scalar(select(func.count(models.ItemCode.id)).where(models.ItemCode.market_item_id == db_item.id))
            print(f"--- [UPDATE ITEM {item_id}] Новое общее кол-во кодов (сток): {current_codes_count} ---") # <-- Лог 4d
            if db_item.stock != current_codes_count:
                 db_item.stock = current_codes_count
                 stock_changed = True # Фиксируем, что сток изменился
                 updated_fields_count += 1


    # Проверяем, были ли вообще изменения
    if updated_fields_count == 0:
         print(f"--- [UPDATE ITEM {item_id}] Не обнаружено изменений для сохранения. Пропускаем commit. ---") # <-- Лог 5
         # Важно: все равно перечитываем, чтобы вернуть актуальные данные с кодами
         result = await db.execute(
             select(models.MarketItem)
             .where(models.MarketItem.id == item_id)
             .options(selectinload(models.MarketItem.codes))
         )
         return result.scalar_one_or_none()

    # Если изменения были, сохраняем
    try:
        print(f"--- [UPDATE ITEM {item_id}] Пытаемся сохранить {updated_fields_count} изменений... ---") # <-- Лог 6
        await db.commit()
        print(f"--- [UPDATE ITEM {item_id}] Commit успешно выполнен ---") # <-- Лог 7
    except Exception as e:
        print(f"--- [UPDATE ITEM {item_id}] ОШИБКА во время commit: {type(e).__name__} - {e} ---") # <-- Лог Ошибки Commit
        await db.rollback()
        raise # Пробрасываем ошибку дальше, чтобы роутер ее поймал

    # Перечитываем объект из базы с кодами для корректного ответа
    # Используем новую сессию для чтения, чтобы не блокировать транзакцию
    print(f"--- [UPDATE ITEM {item_id}] Перечитываем товар из БД с кодами... ---") # <-- Лог 8
    result = await db.execute(
        select(models.MarketItem)
        .where(models.MarketItem.id == item_id)
        .options(selectinload(models.MarketItem.codes))
    )
    updated_item_with_codes = result.scalar_one_or_none()

    if updated_item_with_codes:
         print(f"Данные товара ПОСЛЕ обновления и перечитки: name='{updated_item_with_codes.name}', price={updated_item_with_codes.price}, stock={updated_item_with_codes.stock}, price_rub={updated_item_with_codes.price_rub}, original_price={updated_item_with_codes.original_price}") # <-- Лог 9
    else:
         print(f"--- [UPDATE ITEM {item_id}] ОШИБКА: Не удалось перечитать товар после обновления ---") # <-- Лог ошибки перечитки

    return updated_item_with_codes
    
async def archive_market_item(db: AsyncSession, item_id: int, restore: bool = False):
    """Архивирует или восстанавливает товар."""
    db_item = await db.get(models.MarketItem, item_id)
    if db_item:
        db_item.is_archived = not restore
        db_item.archived_at = datetime.utcnow() if not restore else None
        await db.commit()
        return True
    return False

async def get_archived_items(db: AsyncSession):
    """Получает список архивированных товаров."""
    result = await db.execute(
        select(models.MarketItem)
        .options(selectinload(models.MarketItem.codes))
        .where(models.MarketItem.is_archived == True)
    )
    return result.scalars().all()

# --- Функция полного удаления товара ---
async def admin_delete_item_permanently(db: AsyncSession, item_id: int):
    # --- НАЧАЛО ИЗМЕНЕНИЙ: Безопасное удаление ---

    # 1. Проверяем, есть ли у товара связанные покупки
    purchases_count = await db.scalar(
        select(func.count(models.Purchase.id)).where(models.Purchase.item_id == item_id)
    )

    # 2. Если есть хотя бы одна покупка, вызываем ошибку
    if purchases_count > 0:
        raise ValueError("Невозможно удалить товар, так как он связан с историей покупок.")

    # 3. Если покупок нет, находим и удаляем товар
    db_item = await db.get(models.MarketItem, item_id)
    if not db_item:
        return False  # Товар не найден

    await db.delete(db_item)
    await db.commit()
    return True # Успешное удаление
    
# --- ФУНКЦИИ ДЛЯ РУЛЕТКИ ---

async def assemble_tickets(db: AsyncSession, user_id: int):
    """Собирает части билетиков в целые билеты (4 к 1)."""
    user = await db.get(models.User, user_id)
    if not user or user.ticket_parts < 4:
        raise ValueError("Недостаточно частей для сборки билета.")
    
    new_tickets = user.ticket_parts // 4
    user.tickets += new_tickets
    user.ticket_parts %= 4 # Оставляем остаток (0, 1, 2 или 3)
    
    await db.commit()
    await db.refresh(user)
    return user

async def spin_roulette(db: AsyncSession, user_id: int):
    """
    Прокручивает рулетку, рассчитывает и начисляет выигрыш
    на основе взвешенного шанса для чисел от 1 до 15.
    """
    user = await db.get(models.User, user_id)
    if not user or user.tickets < 1:
        raise ValueError("Недостаточно билетов для прокрутки.")

    user.tickets -= 1

    # --- НОВАЯ ЛОГИКА ВЗВЕШЕННОГО ШАНСА ---

    # Определяем призы и их шансы
    # Формат: (приз, шанс_в_процентах)
    prize_tiers = {
        'small': (list(range(1, 5)), 65),    # Призы от 1 до 5, шанс 65%
        'medium': (list(range(6, 10)), 30),   # Призы от 6 до 10, шанс 30%
        'large': (list(range(11, 15)), 5)     # Призы от 11 до 15, шанс 5%
    }
    
    # Выбираем тир на основе шансов
    tiers = [tier for tier in prize_tiers.keys()]
    weights = [prize_tiers[tier][1] for tier in tiers]
    chosen_tier = random.choices(tiers, weights=weights, k=1)[0]
    
    # Выбираем случайный приз из выпавшего тира
    possible_prizes = prize_tiers[chosen_tier][0]
    prize = random.choice(possible_prizes)

    user.balance += prize

    # Записываем выигрыш в историю
    win_record = models.RouletteWin(user_id=user_id, amount=prize)
    db.add(win_record)
    
    await db.commit()
    await db.refresh(user)
    return {"prize_won": prize, "new_balance": user.balance, "new_tickets": user.tickets}

async def get_roulette_history(db: AsyncSession, limit: int = 20):
    """Получает историю последних выигрышей."""
    result = await db.execute(
        select(models.RouletteWin).order_by(models.RouletteWin.timestamp.desc()).limit(limit)
    )
    return result.scalars().all()

# --- НОВЫЕ ФУНКЦИИ ДЛЯ ПЛАНИРОВЩИКА (CRON) ---

async def reset_ticket_parts(db: AsyncSession):
    """Сбрасывает части билетиков у пользователей, если прошло 3 месяца."""
    three_months_ago = date.today() - relativedelta(months=3)
    await db.execute(
        update(models.User)
        .where(models.User.last_ticket_part_reset <= three_months_ago)
        .values(ticket_parts=0, last_ticket_part_reset=date.today())
    )
    await db.commit()

async def reset_tickets(db: AsyncSession):
    """Сбрасывает билетики у пользователей, если прошло 4 месяца."""
    four_months_ago = date.today() - relativedelta(months=4)
    await db.execute(
        update(models.User)
        .where(models.User.last_ticket_reset <= four_months_ago)
        .values(tickets=0, last_ticket_reset=date.today())
    )
    await db.commit()

async def reset_daily_transfer_limits(db: AsyncSession):
    """Сбрасывает счетчик ежедневных переводов для всех пользователей."""
    await db.execute(
        update(models.User).values(daily_transfer_count=0)
    )
    await db.commit()

# --- ДОБАВЬТЕ ЭТИ НОВЫЕ ФУНКЦИИ В КОНЕЦ ФАЙЛА ---

async def process_pkpass_file(db: AsyncSession, user_id: int, file_content: bytes):
    """
    Обрабатывает файл .pkpass, извлекает данные и СИНХРОНИЗИРУЕТ
    имя и фамилию пользователя с данными карты.
    """
    user = await db.get(models.User, user_id)
    if not user:
        print(f"User not found for user_id: {user_id}")
        return None

    try:
        print(f"Starting pkpass file processing for user {user_id}, file size: {len(file_content)} bytes")
        
        # Проверяем, что файл не пустой
        if not file_content or len(file_content) == 0:
            raise ValueError("File content is empty")
        
        # Пытаемся открыть как ZIP архив
        try:
            pass_zip = zipfile.ZipFile(io.BytesIO(file_content), 'r')
        except zipfile.BadZipFile as e:
            print(f"Invalid ZIP file format: {e}")
            raise ValueError(f"Файл не является корректным .pkpass файлом (неверный формат ZIP): {e}")
        
        with pass_zip:
            # Проверяем наличие pass.json
            if 'pass.json' not in pass_zip.namelist():
                available_files = ', '.join(pass_zip.namelist())
                print(f"pass.json not found in archive. Available files: {available_files}")
                raise ValueError(f"Файл pass.json не найден в архиве. Найдены файлы: {available_files}")
            
            pass_json_bytes = pass_zip.read('pass.json')
            print(f"pass.json read successfully, size: {len(pass_json_bytes)} bytes")
            
            try:
                pass_data = json.loads(pass_json_bytes)
            except json.JSONDecodeError as e:
                print(f"Invalid JSON in pass.json: {e}")
                raise ValueError(f"Ошибка парсинга JSON в pass.json: {e}")
            
            print(f"pass.json parsed successfully. Keys: {list(pass_data.keys())}")
            
            # --- 1. Извлекаем все нужные данные ---
            
            # Штрих-код (как и раньше)
            barcode_data = pass_data.get('barcode', {}).get('message')
            if not barcode_data:
                print("Barcode data not found in pass.json")
                print(f"Barcode structure: {pass_data.get('barcode')}")
                raise ValueError("Данные штрих-кода не найдены в pass.json")

            print(f"Barcode extracted: {barcode_data}")

            # Баланс (как и раньше)
            card_balance = "0"
            header_fields = pass_data.get('storeCard', {}).get('headerFields', [])
            print(f"Header fields: {header_fields}")
            for field in header_fields:
                if field.get('key') == 'field0': # Судя по файлу, ключ баланса 'field0'
                    card_balance = str(field.get('value'))
                    print(f"Balance found: {card_balance}")
                    break
            
            # --- 2. НАЧАЛО НОВОЙ ЛОГИКИ: Извлекаем Имя и Фамилию ---
            full_name_from_card = None
            auxiliary_fields = pass_data.get('storeCard', {}).get('auxiliaryFields', [])
            print(f"Auxiliary fields: {auxiliary_fields}")
            for field in auxiliary_fields:
                # Ищем поле, где label "Владелец карты"
                if field.get('label') == 'Владелец карты':
                    full_name_from_card = field.get('value')
                    print(f"Card owner found: {full_name_from_card}")
                    break

            # --- 3. Обновляем профиль пользователя, если имя найдено ---
            if full_name_from_card:
                # Делим "Виктория Никулина" на ["Виктория", "Никулина"]
                name_parts = full_name_from_card.split()
                first_name_from_card = name_parts[0] if len(name_parts) > 0 else ""
                last_name_from_card = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

                # Сравниваем и обновляем, если есть расхождения
                if user.first_name != first_name_from_card and first_name_from_card:
                    print(f"Updating first_name: {user.first_name} -> {first_name_from_card}")
                    user.first_name = first_name_from_card
                if user.last_name != last_name_from_card and last_name_from_card:
                    print(f"Updating last_name: {user.last_name} -> {last_name_from_card}")
                    user.last_name = last_name_from_card
            
            # --- 4. Сохраняем данные карты в профиль ---
            user.card_barcode = barcode_data
            user.card_balance = card_balance
            
            await db.commit()
            await db.refresh(user)
            print(f"Pkpass file processed successfully for user {user_id}")
            return user
            
    except ValueError as e:
        # ValueError - это ожидаемые ошибки валидации, логируем и пробрасываем дальше
        print(f"Validation error processing pkpass file for user {user_id}: {e}")
        raise
    except Exception as e:
        # Неожиданные ошибки
        print(f"Unexpected error processing pkpass file for user {user_id}: {e}")
        print(traceback.format_exc())
        raise ValueError(f"Ошибка при обработке файла: {str(e)}")

async def delete_user_card(db: AsyncSession, user_id: int):
    user = await db.get(models.User, user_id)
    if user:
        user.card_barcode = None
        user.card_balance = None # --- ИЗМЕНЕНИЕ: Также очищаем баланс ---
        await db.commit()
        await db.refresh(user)
    return user

# ... (в самом конце файла, после delete_user_card)

# --- НАЧАЛО: НОВЫЕ ФУНКЦИИ ДЛЯ СОГЛАСОВАНИЯ ПРОФИЛЯ ---

async def request_profile_update(db: AsyncSession, user: models.User, update_data: schemas.ProfileUpdateRequest):
    """
    Создает запрос на обновление профиля и отправляет уведомление админам.
    """
    
    # 1. Собираем старые данные для сравнения
    old_data = {
        "last_name": user.last_name,
        "department": user.department,
        "position": user.position,
        "phone_number": user.phone_number,
        "date_of_birth": user.date_of_birth.isoformat() if user.date_of_birth else None
    }
    
    # 2. Собираем запрошенные новые данные
    # (exclude_unset=True важен, но фронтенд пришлет все поля, включая неизмененные)
    new_data_raw = update_data.model_dump() 
    
    # 3. Сравниваем, чтобы найти только РЕАЛЬНЫЕ изменения
    actual_new_data = {}
    has_changes = False
    for key, new_val in new_data_raw.items():
        old_val = old_data.get(key)
        if str(old_val or "") != str(new_val or ""): # Сравниваем как строки
             actual_new_data[key] = new_val
             has_changes = True

    if not has_changes:
        # Пользователь нажал "Сохранить", ничего не изменив
        raise ValueError("Изменений не найдено.")

    # 4. Создаем запись в таблице PendingUpdate
    db_update_request = models.PendingUpdate(
        user_id=user.id,
        old_data=old_data, # Сохраняем все старые данные
        new_data=actual_new_data # Сохраняем только то, что изменилось
    )
    db.add(db_update_request)
    await db.commit()
    await db.refresh(db_update_request)

    # 5. Формируем красивое сообщение для админа (сравнение)
    message_lines = [
        f"👤 <b>Запрос на смену данных от:</b> @{escape_html(user.username or user.first_name or '')} ({escape_html(user.last_name or '')})\n"
    ]
    
    for key, new_val in actual_new_data.items():
        old_val = old_data.get(key)
        field_name = key.replace('_', ' ').capitalize()
        old_val_str = escape_html(str(old_val)) if old_val else 'не указано'
        new_val_str = escape_html(str(new_val)) if new_val else 'не указано'
        message_lines.append(f"<b>{escape_html(field_name)}</b>:\n  ↳ Старое: <code>{old_val_str}</code>\n  ↳ Новое: <code>{new_val_str}</code>\n")

    # 6. Отправляем сообщение админу
    admin_message_text = "\n".join(message_lines)
    
    keyboard = {
        "inline_keyboard": [
            [
                {"text": "✅ Одобрить", "callback_data": f"approve_update_{db_update_request.id}"},
                {"text": "❌ Отклонить", "callback_data": f"reject_update_{db_update_request.id}"}
            ]
        ]
    }

    await send_telegram_message(
        chat_id=settings.TELEGRAM_CHAT_ID,
        text=admin_message_text,
        reply_markup=keyboard,
        message_thread_id=settings.TELEGRAM_UPDATE_TOPIC_ID # <-- Используем новую переменную
    )
    
    return db_update_request


async def process_profile_update(db: AsyncSession, update_id: int, action: str):
    """
    Обрабатывает решение админа (Одобрить/Отклонить) по запросу на обновление.
    Возвращает (user, status)
    """
    # 1. Находим сам запрос на обновление
    result = await db.execute(select(models.PendingUpdate).where(models.PendingUpdate.id == update_id))
    pending_update = result.scalars().first()
    
    if not pending_update or pending_update.status != 'pending':
        # Этот запрос уже обработан
        return None, None 

    user = await get_user(db, pending_update.user_id)
    if not user:
        await db.delete(pending_update) # Пользователя нет, удаляем "мусорный" запрос
        await db.commit()
        return None, None

    if action == "approve":
        # 3. ОДОБРЕНО: Применяем изменения (которые хранятся в new_data) к пользователю
        for key, value in pending_update.new_data.items():
            if key == 'date_of_birth' and value:
                try:
                    value = date.fromisoformat(value)
                except (ValueError, TypeError):
                    value = None
            setattr(user, key, value) # Обновляем поле пользователя

        pending_update.status = "approved"
        await db.delete(pending_update) # Удаляем запрос после выполнения
        await db.commit() # Сохраняем и пользователя, и удаление запроса
        
        return user, "approved"
        
    elif action == "reject":
        # 4. ОТКЛОНЕНО: Просто удаляем запрос
        pending_update.status = "rejected"
        await db.delete(pending_update)
        await db.commit()
        
        return user, "rejected"

    return None, None

# --- НОВАЯ ФУНКЦИЯ ДЛЯ ПОИСКА ПОЛЬЗОВАТЕЛЕЙ ---
async def search_users_by_name(db: AsyncSession, query: str):
    """
    Ищет пользователей по частичному совпадению в имени, фамилии, username или номере телефона.
    Поиск регистронезависимый.
    """
    if not query:
        return []
    
    # Убираем символ @ из начала запроса, если он есть (для поиска по username)
    clean_query = query.lstrip('@')
    
    # Создаем шаблон для поиска "внутри" строки (например, "ан" найдет "Иван")
    search_query = f"%{clean_query}%"
    
    result = await db.execute(
        select(models.User).filter(
            and_(
                or_(
                    models.User.first_name.ilike(search_query),
                    models.User.last_name.ilike(search_query),
                    models.User.username.ilike(search_query),
                    models.User.phone_number.ilike(search_query)
                ),
                models.User.status != 'deleted',  # Исключаем анонимизированных пользователей
                models.User.status != 'rejected'  # Исключаем отклоненных пользователей
            )
        ).limit(20) # Ограничиваем вывод, чтобы не возвращать тысячи пользователей
    )
    return result.scalars().all()

# --- НАЧАЛО: НОВЫЕ ФУНКЦИИ ДЛЯ АДМИН-ПАНЕЛИ УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ ---

async def get_all_users_for_admin(db: AsyncSession):
    """Получает всех пользователей для админ-панели."""
    result = await db.execute(
        select(models.User)
        .where(models.User.status != 'deleted')
        .order_by(models.User.last_name)
    )
    return result.scalars().all()

async def admin_update_user(db: AsyncSession, user_id: int, user_data: schemas.AdminUserUpdate, admin_user: models.User):
    """
    Обновляет данные пользователя от имени администратора и отправляет лог.
    (Версия с исправленной логикой сравнения)
    """
    user = await get_user(db, user_id)
    if not user:
        return None
    
    update_data = user_data.model_dump(exclude_unset=True)
    changes_log = []

    # Проходим по всем полям, которые пришли с фронтенда
    for key, new_value in update_data.items():
        old_value = getattr(user, key, None)
        
        # --- НАЧАЛО НОВОЙ, УМНОЙ ЛОГИКИ СРАВНЕНИЯ ---
        is_changed = False
        
        # 1. Отдельно обрабатываем дату, т.к. сравниваем объект date и строку
        if isinstance(old_value, date):
            old_value_str = old_value.isoformat()
            if old_value_str != new_value:
                is_changed = True
        # 2. Отдельно обрабатываем None и пустые строки для текстовых полей
        elif (old_value is None and new_value != "") or \
             (new_value is None and old_value != ""):
            # Считаем изменением, если было "ничего", а стала пустая строка (и наоборот)
            # Это можно закомментировать, если такое поведение не нужно
            if str(old_value) != str(new_value):
                 is_changed = True
        # 3. Сравниваем все остальные типы (числа, строки, булевы) напрямую
        elif type(old_value) != type(new_value) and old_value is not None:
             # Если типы разные (например, int и str), пытаемся привести к типу из БД
             try:
                 if old_value != type(old_value)(new_value):
                     is_changed = True
             except (ValueError, TypeError):
                 is_changed = True # Не смогли привести типы - точно изменение
        elif old_value != new_value:
            is_changed = True
        # --- КОНЕЦ НОВОЙ ЛОГИКИ СРАВНЕНИЯ ---

        if is_changed:
            changes_log.append(f"  - {key}: `{old_value}` -> `{new_value}`")
        
        # Применяем изменения к объекту пользователя (конвертируя дату)
        if key == 'date_of_birth' and new_value:
            try:
                setattr(user, key, date.fromisoformat(new_value))
            except (ValueError, TypeError):
                setattr(user, key, None)
        elif key == 'password' and new_value:
            # Хешируем пароль перед сохранением
            user.password_hash = get_password_hash(new_value)
            # Не сохраняем сам пароль в поле password (его там нет в модели)
        else:
            setattr(user, key, new_value)
    
    # Автоматически включаем browser_auth_enabled, если есть логин и пароль
    if user.login and user.password_hash:
        if not user.browser_auth_enabled:
            user.browser_auth_enabled = True
            changes_log.append(f"  - browser_auth_enabled: `False` -> `True` (автоматически включено при наличии логина и пароля)")
    
    # Отправляем уведомление, только если были реальные изменения
    if changes_log:
        await db.commit()
        await db.refresh(user)

        admin_name = f"@{admin_user.username}" if admin_user.username else f"{admin_user.first_name} {admin_user.last_name}"
        target_user_name = f"@{user.username}" if user.username else f"{user.first_name} {user.last_name}"
        
        log_message = (
            f"✏️ <b>Админ изменил профиль</b>\n\n"
            f"👤 <b>Администратор:</b> {escape_html(admin_name)}\n"
            f"🎯 <b>Пользователь:</b> {escape_html(target_user_name)}\n\n"
            f"<b>Изменения:</b>\n" + "\n".join([escape_html(change) for change in changes_log])
        )
        
        await bot.send_telegram_message(
            chat_id=settings.TELEGRAM_CHAT_ID,
            text=log_message,
            message_thread_id=settings.TELEGRAM_ADMIN_LOG_TOPIC_ID
        )
    else:
        # Если изменений не было, ничего не сохраняем и не отправляем
        pass

    return user

# --- удаление пользователей ---
async def admin_delete_user(db: AsyncSession, user_id: int, admin_user: models.User):
    """Анонимизирует пользователя, удаляя его личные данные, но сохраняя историю."""
    user_to_anonymize = await db.get(models.User, user_id)
    if not user_to_anonymize:
        # Если пользователь не найден, возвращаем None, чтобы обработать это в роутере
        return None
    if user_to_anonymize.id == admin_user.id:
        raise ValueError("Администратор не может удалить сам себя.")

    # --- НАЧАЛО ИЗМЕНЕНИЙ: Анонимизация вместо удаления ---

    # 1. Сохраняем имена для лога, пока они еще не стерты
    admin_name = f"{admin_user.first_name} {admin_user.last_name or ''}".strip()
    target_user_name = f"{user_to_anonymize.first_name} {user_to_anonymize.last_name or ''}".strip()

    # 2. Находим минимальный отрицательный telegram_id для последовательной нумерации
    # Это позволяет избежать конфликтов уникальности в БД
    result = await db.execute(
        select(func.min(models.User.telegram_id))
        .where(models.User.telegram_id < 0)
    )
    min_negative_id = result.scalar()
    
    # Если есть уже анонимизированные пользователи, берем следующий номер
    # Если нет, начинаем с -1
    new_telegram_id = (min_negative_id - 1) if min_negative_id else -1

    # 3. Затираем личные данные пользователя
    user_to_anonymize.first_name = "Удаленный"
    user_to_anonymize.last_name = "Пользователь"
    user_to_anonymize.telegram_id = new_telegram_id  # Устанавливаем последовательный отрицательный ID
    user_to_anonymize.username = None       # <-- Требует изменений в базе данных, которые мы обсуждали
    user_to_anonymize.phone_number = ""  # Пустая строка вместо None (поле nullable=False)
    user_to_anonymize.position = "Удален"  # Анонимизируем должность (поле nullable=False)
    user_to_anonymize.department = "Удален"  # Анонимизируем отдел (поле nullable=False)
    user_to_anonymize.date_of_birth = date(1900, 1, 1)  # Дефолтная дата (поле nullable=False)
    user_to_anonymize.telegram_photo_url = None
    user_to_anonymize.is_admin = False
    user_to_anonymize.status = "deleted" # Меняем статус, чтобы скрыть его из списков

    # 4. Сохраняем изменения в базе
    db.add(user_to_anonymize)
    await db.commit()

    # 5. Отправляем уведомление об анонимизации
    log_message = (
        f"🗑️ <b>Админ анонимизировал пользователя</b>\n\n"
        f"👤 <b>Администратор:</b> {escape_html(admin_name)} (<code>{admin_user.id}</code>)\n"
        f"🎯 <b>Бывший пользователь:</b> {escape_html(target_user_name)} (<code>{user_id}</code>)\n\n"
        f"Личные данные пользователя стерты, история транзакций сохранена."
    )
    
    await bot.send_telegram_message(
        chat_id=config.settings.TELEGRAM_CHAT_ID,
        text=log_message,
        message_thread_id=config.settings.TELEGRAM_ADMIN_LOG_TOPIC_ID
    )

    # 6. Возвращаем измененный (теперь анонимный) объект пользователя
    return user_to_anonymize

# --- ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ УЧЕТНЫМИ ДАННЫМИ ---
async def set_user_credentials(db: AsyncSession, user_id: int, login: str, password: str):
    """
    Устанавливает логин и пароль для пользователя.
    Включает browser_auth_enabled для возможности входа через браузер.
    """
    # Получаем пользователя
    user = await get_user(db, user_id)
    if not user:
        raise ValueError("Пользователь не найден")
    
    # Валидация логина
    if len(login) < 3:
        raise ValueError("Логин должен содержать минимум 3 символа")
    
    # Валидация пароля
    if len(password) < 6:
        raise ValueError("Пароль должен содержать минимум 6 символов")
    
    # Проверяем, не занят ли логин другим пользователем
    result = await db.execute(
        select(models.User).where(
            models.User.login == login,
            models.User.id != user_id
        )
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise ValueError("Логин уже занят другим пользователем")
    
    # Устанавливаем логин и пароль
    user.login = login
    user.password_hash = get_password_hash(password)
    user.browser_auth_enabled = True
    
    await db.commit()
    await db.refresh(user)
    
    return user

# --- ФУНКЦИЯ ДЛЯ ПРОВЕРКИ ЛОГИНА И ПАРОЛЯ ---
async def verify_user_credentials(db: AsyncSession, login: str, password: str):
    """
    Проверяет логин/email и пароль пользователя.
    Возвращает пользователя, если учетные данные верны, иначе None.
    Поддерживает вход как по логину, так и по email.
    """
    # Ищем пользователя по логину или email
    result = await db.execute(
        select(models.User).where(
            or_(
                models.User.login == login,
                models.User.email == login
            ),
            models.User.browser_auth_enabled == True
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        return None
    
    # Проверяем пароль
    if not user.password_hash:
        return None
    
    if not verify_password(password, user.password_hash):
        return None
    
    # Обновляем время последнего входа
    user.last_login_date = datetime.utcnow()
    await db.commit()
    await db.refresh(user)
    
    return user

async def link_telegram_to_web_account(db: AsyncSession, telegram_id: int, email: str):
    """
    Связывает Telegram-аккаунт с веб-аккаунтом по email.
    Возвращает обновленного пользователя или None, если аккаунт не найден.
    """
    if not email or not email.strip():
        raise ValueError("Email обязателен для связывания аккаунтов")
    
    # Проверяем, не занят ли уже telegram_id другим пользователем
    existing_telegram_user = await get_user_by_telegram(db, telegram_id)
    if existing_telegram_user:
        raise ValueError("Этот Telegram-аккаунт уже связан с другим пользователем")
    
    # Ищем веб-аккаунт по email
    web_user = await get_user_by_email(db, email)
    if not web_user:
        raise ValueError("Аккаунт с таким email не найден")
    
    # Проверяем, не связан ли уже веб-аккаунт с другим Telegram-аккаунтом
    if web_user.telegram_id and web_user.telegram_id >= 0:
        raise ValueError("Этот веб-аккаунт уже связан с другим Telegram-аккаунтом")
    
    # Связываем аккаунты
    web_user.telegram_id = telegram_id
    await db.commit()
    await db.refresh(web_user)
    
    return web_user

# --- ФУНКЦИЯ ДЛЯ ГЕНЕРАЦИИ ЛОГИНА НА ОСНОВЕ ИМЕНИ И ФАМИЛИИ ---
def generate_login_from_name(first_name: Optional[str], last_name: Optional[str], user_id: int) -> str:
    """
    Генерирует логин на основе имени и фамилии пользователя.
    Если имя/фамилия отсутствуют, использует user_id.
    """
    import re
    
    if first_name and last_name:
        # Транслитерация кириллицы в латиницу (базовая)
        translit_map = {
            'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
            'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
            'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
            'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
            'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
        }
        
        def transliterate(text: str) -> str:
            result = ''
            for char in text.lower():
                if char in translit_map:
                    result += translit_map[char]
                elif char.isalnum():
                    result += char
            return result
        
        first_translit = transliterate(first_name)
        last_translit = transliterate(last_name)
        
        if first_translit and last_translit:
            base_login = f"{first_translit}.{last_translit}"
        elif first_translit:
            base_login = first_translit
        elif last_translit:
            base_login = last_translit
        else:
            base_login = f"user{user_id}"
    else:
        base_login = f"user{user_id}"
    
    # Очищаем от всех недопустимых символов, оставляем только буквы, цифры и точку
    base_login = re.sub(r'[^a-z0-9.]', '', base_login.lower())
    
    # Если логин пустой или слишком короткий, используем user_id
    if not base_login or len(base_login) < 3:
        base_login = f"user{user_id}"
    
    return base_login

# --- ФУНКЦИЯ ДЛЯ ГЕНЕРАЦИИ СЛУЧАЙНОГО ПАРОЛЯ ---
def generate_random_password(length: int = 12) -> str:
    """Генерирует случайный пароль заданной длины."""
    import secrets
    import string
    
    charset = string.ascii_letters + string.digits + '!@#$%^&*'
    password = ''.join(secrets.choice(charset) for _ in range(length))
    return password

async def bulk_send_credentials(
    db: AsyncSession,
    custom_message: str = "",
    include_active: bool = True,
    include_blocked: bool = True,
    regenerate_existing: bool = False
):
    """
    Генерирует логины и пароли для пользователей и отправляет их через Telegram.
    
    Args:
        db: Сессия базы данных
        custom_message: Пользовательское текстовое сообщение для добавления к рассылке
        include_active: Включить активных пользователей
        include_blocked: Включить заблокированных пользователей
        regenerate_existing: Перегенерировать логин/пароль для тех, у кого уже есть логин
    
    Returns:
        dict со статистикой: total_users, credentials_generated, messages_sent, failed_users
    """
    # Формируем условия для выборки пользователей
    status_conditions = []
    if include_active:
        status_conditions.append(models.User.status == 'approved')
    if include_blocked:
        status_conditions.append(models.User.status == 'blocked')
    
    if not status_conditions:
        raise ValueError("Необходимо выбрать хотя бы один тип пользователей (активные или заблокированные)")
    
    # Получаем всех пользователей по статусам
    query = select(models.User).where(
        or_(*status_conditions),
        models.User.status != 'deleted',
        models.User.status != 'rejected',
        models.User.telegram_id.isnot(None),
        models.User.telegram_id >= 0  # Исключаем анонимизированных
    )
    
    result = await db.execute(query)
    all_users = result.scalars().all()
    
    total_users = len(all_users)
    credentials_generated = 0
    messages_sent = 0
    failed_users = []
    
    # Обрабатываем каждого пользователя
    for user in all_users:
        login = None
        password = None
        user_credentials_generated = False
        
        try:
            # Проверяем, нужно ли генерировать учетные данные
            if user.login and not regenerate_existing:
                # У пользователя уже есть логин и мы не перегенерируем
                continue
            
            # Генерируем логин
            if not user.login or regenerate_existing:
                base_login = generate_login_from_name(user.first_name, user.last_name, user.id)
                
                # Проверяем уникальность логина
                login = base_login
                counter = 1
                while True:
                    check_result = await db.execute(
                        select(models.User).where(
                            models.User.login == login,
                            models.User.id != user.id
                        )
                    )
                    if check_result.scalar_one_or_none() is None:
                        break
                    login = f"{base_login}{counter}"
                    counter += 1
                
                # Генерируем пароль
                password = generate_random_password(12)
                
                # Устанавливаем учетные данные
                user.login = login
                user.password_hash = get_password_hash(password)
                user.browser_auth_enabled = True
                
                credentials_generated += 1
                user_credentials_generated = True
            else:
                # Используем существующие учетные данные (но пароль не можем восстановить)
                # В этом случае не отправляем сообщение, так как пароль неизвестен
                continue
            
            # Отправляем сообщение через Telegram
            if user.telegram_id and user.telegram_id >= 0:
                message_text = f"🔐 <b>Ваши учетные данные для входа в систему</b>\n\n"
                
                if custom_message:
                    message_text += f"{escape_html(custom_message)}\n\n"
                
                message_text += (
                    f"👤 <b>Логин:</b> <code>{escape_html(user.login)}</code>\n"
                    f"🔑 <b>Пароль:</b> <code>{escape_html(password)}</code>\n\n"
                    f"⚠️ <i>Сохраните эти данные в безопасном месте. Пароль больше не будет показан.</i>"
                )
                
                try:
                    await send_telegram_message(
                        chat_id=user.telegram_id,
                        text=message_text,
                        parse_mode='HTML'
                    )
                    messages_sent += 1
                except Exception as e:
                    logger.error(f"Не удалось отправить сообщение пользователю {user.id} ({user.telegram_id}): {e}")
                    failed_users.append(user.id)
                    # Откатываем изменения для этого пользователя
                    if user_credentials_generated:
                        user.login = None
                        user.password_hash = None
                        user.browser_auth_enabled = False
                        credentials_generated -= 1
            
        except Exception as e:
            logger.error(f"Ошибка при обработке пользователя {user.id}: {e}")
            failed_users.append(user.id)
            # Откатываем изменения для этого пользователя, если они были сделаны
            if user_credentials_generated:
                user.login = None
                user.password_hash = None
                user.browser_auth_enabled = False
                credentials_generated -= 1
    
    # Сохраняем все изменения
    await db.commit()
    
    return {
        "total_users": total_users,
        "credentials_generated": credentials_generated,
        "messages_sent": messages_sent,
        "failed_users": failed_users
    }

# --- ДОБАВЬ ЭТУ НОВУЮ ФУНКЦИЮ В КОНЕЦ ФАЙЛА ---
async def get_leaderboards_status(db: AsyncSession):
    """Проверяет, какие из рейтингов не пусты."""
    
    periods = {
        'current_month': (
            datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0),
            datetime.utcnow()
        ),
        'last_month': (
            (datetime.utcnow().replace(day=1) - timedelta(days=1)).replace(day=1, hour=0, minute=0, second=0, microsecond=0),
            datetime.utcnow().replace(day=1) - timedelta(seconds=1)
        ),
        'all_time': (None, None)
    }
    
    statuses = []
    
    for period_key, (start_date, end_date) in periods.items():
        # Проверяем для "получателей"
        query_received = select(func.count(models.Transaction.id))
        if start_date and end_date:
            query_received = query_received.where(models.Transaction.timestamp.between(start_date, end_date))
        count_received = await db.scalar(query_received)
        statuses.append({ "id": f"{period_key}_received", "has_data": count_received > 0 })

        # Проверяем для "отправителей" (щедрость)
        query_sent = select(func.count(models.Transaction.id))
        if start_date and end_date:
            query_sent = query_sent.where(models.Transaction.timestamp.between(start_date, end_date))
        count_sent = await db.scalar(query_sent)
        statuses.append({ "id": f"{period_key}_sent", "has_data": count_sent > 0 })
            
    return statuses

# --- НАЧАЛО: НОВЫЕ ФУНКЦИИ ДЛЯ СТАТИСТИКИ ---

# Вспомогательная функция, чтобы не дублировать код
def _prepare_dates(start_date: Optional[date], end_date: Optional[date]):
    if end_date is None:
        end_date = datetime.utcnow().date()
    if start_date is None:
        start_date = end_date - timedelta(days=30)
    
    # --- ГЛАВНОЕ ИСПРАВЛЕНИЕ: Добавляем 1 день к конечной дате ---
    # Это включает весь последний день в диапазон (до 23:59:59)
    end_date_inclusive = end_date + timedelta(days=1)
    
    return start_date, end_date_inclusive

async def get_general_statistics(db: AsyncSession, start_date: Optional[date] = None, end_date: Optional[date] = None):
    start_date, end_date_inclusive = _prepare_dates(start_date, end_date)
        
    # Исправлено: считаем новых пользователей в периоде, а не всех пользователей
    query_new_users = select(func.count(models.User.id)).where(
        models.User.status != 'deleted',
        models.User.registration_date.between(start_date, end_date_inclusive)
    )
    new_users_count = (await db.execute(query_new_users)).scalar_one()

    active_senders_q = select(models.Transaction.sender_id).join(
        models.User, models.User.id == models.Transaction.sender_id
    ).where(
        models.Transaction.timestamp.between(start_date, end_date_inclusive),
        models.User.status != 'deleted'
    ).distinct()

    active_receivers_q = select(models.Transaction.receiver_id).join(
        models.User, models.User.id == models.Transaction.receiver_id
    ).where(
        models.Transaction.timestamp.between(start_date, end_date_inclusive),
        models.User.status != 'deleted'
    ).distinct()

    active_senders_ids = (await db.execute(active_senders_q)).scalars().all()
    active_receivers_ids = (await db.execute(active_receivers_q)).scalars().all()
    active_users_count = len(set(active_senders_ids).union(set(active_receivers_ids)))

    query_transactions = select(func.count(models.Transaction.id)).filter(models.Transaction.timestamp.between(start_date, end_date_inclusive))
    transactions_count = (await db.execute(query_transactions)).scalar_one()

    query_purchases = select(func.count(models.Purchase.id)).filter(models.Purchase.timestamp.between(start_date, end_date_inclusive))
    shop_purchases = (await db.execute(query_purchases)).scalar_one()

    query_turnover = select(func.sum(models.Transaction.amount)).filter(models.Transaction.timestamp.between(start_date, end_date_inclusive))
    total_turnover = (await db.execute(query_turnover)).scalar_one_or_none() or 0

    query_spent = (
        select(func.sum(models.MarketItem.price))
        .join(models.Purchase, models.Purchase.item_id == models.MarketItem.id)
        .filter(models.Purchase.timestamp.between(start_date, end_date_inclusive))
    )
    total_store_spent = (await db.execute(query_spent)).scalar_one_or_none() or 0

    return {
        "new_users_count": new_users_count,
        "active_users_count": active_users_count,
        "transactions_count": transactions_count,
        "store_purchases_count": shop_purchases,
        "total_turnover": total_turnover,
        "total_store_spent": total_store_spent,
    }

async def get_hourly_activity_stats(db: AsyncSession, start_date: Optional[date] = None, end_date: Optional[date] = None):
    start_date, end_date_inclusive = _prepare_dates(start_date, end_date)
    
    moscow_time = models.Transaction.timestamp.op("AT TIME ZONE")('UTC').op("AT TIME ZONE")('Europe/Moscow')
    
    query = (
        select(
            extract('hour', moscow_time).label('hour'),
            func.count(models.Transaction.id).label('transaction_count')
        )
        .join(models.User, models.User.id == models.Transaction.sender_id)
        .filter(
            models.Transaction.timestamp.between(start_date, end_date_inclusive),
            models.User.status != 'deleted'
        )
        .group_by(extract('hour', moscow_time))
    )
    result = await db.execute(query)
    activity = result.all()
    hourly_stats = {hour: 0 for hour in range(24)}
    for row in activity:
        if row.hour is not None: hourly_stats[row.hour] = row.transaction_count
    return hourly_stats

async def get_login_activity_stats(db: AsyncSession, start_date: Optional[date] = None, end_date: Optional[date] = None):
    start_date, end_date_inclusive = _prepare_dates(start_date, end_date)
    
    moscow_time = models.User.last_login_date.op("AT TIME ZONE")('UTC').op("AT TIME ZONE")('Europe/Moscow')

    query = (
        select(
            extract('hour', moscow_time).label('hour'),
            func.count(models.User.id).label('login_count')
        )
        .filter(
            models.User.last_login_date.isnot(None),  # Исключаем пользователей без логина
            models.User.last_login_date.between(start_date, end_date_inclusive),
            models.User.status != 'deleted'
        )
        .group_by(extract('hour', moscow_time))
    )
    result = await db.execute(query)
    activity = result.all()
    hourly_stats = {hour: 0 for hour in range(24)}
    for row in activity:
        if row.hour is not None: hourly_stats[row.hour] = row.login_count
    return hourly_stats
    
async def get_user_engagement_stats(db: AsyncSession, start_date: Optional[date] = None, end_date: Optional[date] = None, limit: int = 5):
    if end_date is None: end_date = datetime.utcnow().date()
    if start_date is None: start_date = end_date - timedelta(days=365*5)
    end_date_inclusive = end_date + timedelta(days=1)

    query_senders = (
        select(models.User, func.count(models.Transaction.id).label('sent_count'))
        .join(models.Transaction, models.User.id == models.Transaction.sender_id)
        .filter(
            models.Transaction.timestamp.between(start_date, end_date_inclusive),
            models.User.status != 'deleted'
        )
        .group_by(models.User.id)
        .order_by(func.count(models.Transaction.id).desc()).limit(limit)
    )
    top_senders = (await db.execute(query_senders)).all()

    query_receivers = (
        select(models.User, func.count(models.Transaction.id).label('received_count'))
        .join(models.Transaction, models.User.id == models.Transaction.receiver_id)
        .filter(
            models.Transaction.timestamp.between(start_date, end_date_inclusive),
            models.User.status != 'deleted'
        )
        .group_by(models.User.id)
        .order_by(func.count(models.Transaction.id).desc()).limit(limit)
    )
    top_receivers = (await db.execute(query_receivers)).all()
    
    return {"top_senders": top_senders, "top_receivers": top_receivers}

async def get_popular_items_stats(db: AsyncSession, start_date: Optional[date] = None, end_date: Optional[date] = None, limit: int = 10):
    # Используем твою логику обработки дат
    if end_date is None: end_date = datetime.utcnow().date()
    if start_date is None: start_date = end_date - timedelta(days=365*5)
    end_date_inclusive = end_date + timedelta(days=1)

    # --- ИСПРАВЛЕНИЕ: Используем INNER JOIN вместо LEFT JOIN, чтобы показывать только товары с покупками в периоде
    # Фильтр по дате применяем в условии JOIN для корректной работы
    query = (
        select(models.MarketItem, func.count(models.Purchase.id).label('purchase_count'))
        .join(
            models.Purchase, 
            and_(
                models.MarketItem.id == models.Purchase.item_id,
                models.Purchase.timestamp.between(start_date, end_date_inclusive)
            )
        )
        .options(selectinload(models.MarketItem.codes))
        .group_by(models.MarketItem.id)
        .order_by(func.count(models.Purchase.id).desc())
        .limit(limit)
    )
    # Возвращаем результат как есть, FastAPI/Pydantic сами преобразуют его
    return (await db.execute(query)).all()

async def get_inactive_users(db: AsyncSession, start_date: Optional[date] = None, end_date: Optional[date] = None):
    start_date, end_date_inclusive = _prepare_dates(start_date, end_date)

    active_senders_q = select(models.Transaction.sender_id).filter(models.Transaction.timestamp.between(start_date, end_date_inclusive)).distinct()
    active_recipients_q = select(models.Transaction.receiver_id).filter(models.Transaction.timestamp.between(start_date, end_date_inclusive)).distinct()
    
    active_senders = (await db.execute(active_senders_q)).scalars().all()
    active_recipients = (await db.execute(active_recipients_q)).scalars().all()
    
    active_user_ids = set(active_senders).union(set(active_recipients))
    
    # Исправлено: обрабатываем случай пустого списка активных пользователей
    if not active_user_ids:
        # Если нет активных пользователей, возвращаем всех неактивных
        return (await db.execute(select(models.User).filter(
            models.User.status != 'deleted'
        ))).scalars().all()
    
    return (await db.execute(select(models.User).filter(
        models.User.id.notin_(active_user_ids),
        models.User.status != 'deleted'
    ))).scalars().all()
    
async def get_total_balance(db: AsyncSession):
    total = (await db.execute(
        select(func.sum(models.User.balance)).where(models.User.status != 'deleted')
    )).scalar_one_or_none()
    return total or 0

async def get_active_user_ratio(db: AsyncSession):
    total_users = (await db.execute(
        select(func.count(models.User.id)).where(models.User.status != 'deleted')
    )).scalar_one()

    active_senders_q = select(models.Transaction.sender_id).join(
        models.User, models.User.id == models.Transaction.sender_id
    ).where(models.User.status != 'deleted').distinct()
    
    active_recipients_q = select(models.Transaction.receiver_id).join(
        models.User, models.User.id == models.Transaction.receiver_id
    ).where(models.User.status != 'deleted').distinct()

    active_senders = (await db.execute(active_senders_q)).scalars().all()
    active_recipients = (await db.execute(active_recipients_q)).scalars().all()
    
    active_user_ids_count = len(set(active_senders).union(set(active_recipients)))
    inactive_users_count = total_users - active_user_ids_count
    return {"active_users": active_user_ids_count, "inactive_users": inactive_users_count}

async def get_average_session_duration(db: AsyncSession, start_date: Optional[date] = None, end_date: Optional[date] = None):
    start_date, end_date_inclusive = _prepare_dates(start_date, end_date)

    session_duration = func.extract('epoch', models.UserSession.last_seen - models.UserSession.session_start)
    
    query = (
        select(func.avg(session_duration))
        .join(models.User, models.User.id == models.UserSession.user_id)
        .filter(
            models.UserSession.session_start.between(start_date, end_date_inclusive),
            models.User.status != 'deleted'
        )
    )
    
    average_seconds = (await db.execute(query)).scalar_one_or_none() or 0
    average_minutes = round(average_seconds / 60, 2)
    
    return {"average_duration_minutes": average_minutes}

# --- НОВАЯ ФУНКЦИЯ ДЛЯ ОБУЧЕНИЯ ---

async def mark_onboarding_as_seen(db: AsyncSession, user_id: int):
    """Отмечает, что пользователь прошел обучение."""
    user = await db.get(models.User, user_id)
    if user:
        user.has_seen_onboarding = True
        await db.commit()
        await db.refresh(user)
    return user

async def mark_user_interacted_with_bot(db: AsyncSession, user_id: int):
    """Отмечает, что пользователь взаимодействовал с ботом."""
    user = await db.get(models.User, user_id)
    if user:
        user.has_interacted_with_bot = True
        await db.commit()
        await db.refresh(user)
    return user

# --- НАЧАЛО БЛОКА: Возвращаем функции для работы с сессиями ---

async def start_user_session(db: AsyncSession, user_id: int) -> models.UserSession:
    """Создает новую запись о сессии для пользователя."""
    new_session = models.UserSession(user_id=user_id)
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return new_session

async def ping_user_session(db: AsyncSession, session_id: int) -> Optional[models.UserSession]:
    """Обновляет время 'last_seen' для существующей сессии."""
    result = await db.execute(select(models.UserSession).filter(models.UserSession.id == session_id))
    session = result.scalar_one_or_none()
    
    if session:
        session.last_seen = datetime.utcnow()
        await db.commit()
        await db.refresh(session)
    
    return session

async def generate_monthly_leaderboard_banners(db: AsyncSession):
    """
    Создает баннеры для Топ-3 прошлого месяца (получатели и отправители).
    Удаляет старые баннеры рейтинга.
    """
    
    # 1. Удаляем все старые баннеры рейтинга
    await db.execute(
        delete(models.Banner).where(
            models.Banner.banner_type.in_(['leaderboard_receivers', 'leaderboard_senders'])
        )
    )
    
    # 2. Получаем Топ-3 Получателей (за прошлый месяц)
    try:
        top_receivers_data = await get_leaderboard_data(
            db, 
            period='last_month', 
            leaderboard_type='received'
        )
        
        # 3. Форматируем данные (берем только топ-3)
        top_3_receivers = [
            {
                "rank": i + 1,
                "first_name": item["user"].first_name,
                "last_name": item["user"].last_name,
                "telegram_photo_url": item["user"].telegram_photo_url,
                "total_received": item["total_received"]
            }
            for i, item in enumerate(top_receivers_data[:3])
        ]

        # 4. Создаем новый баннер для Получателей (если есть данные)
        if top_3_receivers:
            receivers_banner = models.Banner(
                banner_type='leaderboard_receivers',
                position='main', # Чтобы был в главном слайдере
                is_active=True,
                link_url='/leaderboard', # Фронтенд поймет этот "внутренний" URL
                data={"users": top_3_receivers}
            )
            db.add(receivers_banner)

    except Exception as e:
        print(f"Failed to generate 'receivers' leaderboard banner: {e}")

    # 5. Получаем Топ-3 Отправителей (Щедрость, за прошлый месяц)
    try:
        top_senders_data = await get_leaderboard_data(
            db, 
            period='last_month', # <-- Убедись, что твоя функция get_leaderboard_data
                                 #     корректно работает с 'last_month' для 'sent'
            leaderboard_type='sent'
        )
        
        top_3_senders = [
            {
                "rank": i + 1,
                "first_name": item["user"].first_name,
                "last_name": item["user"].last_name,
                "telegram_photo_url": item["user"].telegram_photo_url,
                "total_received": item["total_received"] # В схеме это total_received, даже для 'sent'
            }
            for i, item in enumerate(top_senders_data[:3])
        ]

        # 6. Создаем новый баннер для Отправителей (если есть данные)
        if top_3_senders:
            senders_banner = models.Banner(
                banner_type='leaderboard_senders',
                position='main',
                is_active=True,
                link_url='/leaderboard', # TODO: Можно уточнить ссылку, если рейтинг щедрости отдельно
                data={"users": top_3_senders}
            )
            db.add(senders_banner)

    except Exception as e:
        print(f"Failed to generate 'senders' leaderboard banner: {e}")

    # 7. Сохраняем все изменения (удаление старых, добавление новых)
    await db.commit()
    print("Monthly leaderboard banners generated successfully.")

# --- CRUD ОПЕРАЦИИ ДЛЯ STATIX BONUS ---
async def get_statix_bonus_item(db: AsyncSession):
    """Получить активный товар Statix Bonus"""
    result = await db.execute(
        select(models.StatixBonusItem).where(models.StatixBonusItem.is_active == True)
    )
    return result.scalars().first()

async def create_statix_bonus_item(db: AsyncSession, item_data: dict):
    """Создать товар Statix Bonus"""
    db_item = models.StatixBonusItem(**item_data)
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item

async def update_statix_bonus_item(db: AsyncSession, item_id: int, item_data: dict):
    """Обновить товар Statix Bonus"""
    result = await db.execute(
        select(models.StatixBonusItem).where(models.StatixBonusItem.id == item_id)
    )
    db_item = result.scalars().first()
    if not db_item:
        return None
    
    for key, value in item_data.items():
        if value is not None:
            setattr(db_item, key, value)
    
    await db.commit()
    await db.refresh(db_item)
    return db_item

def _normalize_statix_phone(phone_number: Optional[str]) -> str:
    digits = re.sub(r"\D", "", phone_number or "")
    if not digits:
        raise ValueError("У пользователя не указан номер телефона для начисления Statix бонусов")

    if len(digits) == 10:
        digits = f"7{digits}"
    elif len(digits) == 11:
        if digits.startswith("8"):
            digits = f"7{digits[1:]}"
        elif not digits.startswith("7"):
            raise ValueError("Некорректный формат номера телефона для начисления Statix бонусов")
    else:
        raise ValueError("Некорректный формат номера телефона для начисления Statix бонусов")

    return digits


def _extract_statix_error_message(response: Optional[httpx.Response]) -> str:
    if response is None:
        return "неизвестная ошибка"

    try:
        payload = response.json()
    except ValueError:
        payload = None

    if isinstance(payload, dict):
        for key in ("message", "error", "detail", "description"):
            value = payload.get(key)
            if value:
                return str(value)
    return response.text or "неизвестная ошибка"


async def _send_statix_bonus_request(phone: str, bonus_amount: int, card_number: str) -> Optional[dict]:
    payload = {
        "action": settings.STATIX_BONUS_ACTION,
        "bonus_points": bonus_amount,
        "card_number": card_number,
        "credentials": {
            "login": settings.STATIX_BONUS_LOGIN,
            "password": settings.STATIX_BONUS_PASSWORD,
        },
        "restaurant": {
            "name": settings.STATIX_BONUS_RESTAURANT_NAME,
        },
    }

    timeout_seconds = settings.STATIX_BONUS_TIMEOUT_SECONDS or 10

    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout_seconds)) as client:
        try:
            response = await client.post(
                settings.STATIX_BONUS_API_URL,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            message = _extract_statix_error_message(exc.response)
            logger.error(
                "Statix Bonus API HTTP error (status=%s): %s", exc.response.status_code if exc.response else "?", message
            )
            raise ValueError(f"Statix Bonus API вернул ошибку: {message}") from exc
        except httpx.RequestError as exc:
            logger.error("Statix Bonus API недоступен: %s", exc, exc_info=True)
            raise ValueError("Statix Bonus API недоступен, попробуйте позже.") from exc

    try:
        data = response.json()
    except ValueError:
        data = None

    if isinstance(data, dict):
        status_value = str(data.get("status", "")).lower()
        if status_value and status_value not in {"ok", "success", "done"}:
            message = data.get("message") or data.get("error") or str(data)
            logger.error("Statix Bonus API вернул ошибочный статус: %s", message)
            raise ValueError(f"Statix Bonus API вернул ошибку: {message}")

    return data if isinstance(data, dict) else None


async def create_statix_bonus_purchase(db: AsyncSession, user_id: int, bonus_amount: int):
    """Создать покупку бонусов Statix"""
    # Получаем настройки товара
    statix_item = await get_statix_bonus_item(db)
    if not statix_item:
        raise ValueError("Statix Bonus товар не настроен")
    
    # Рассчитываем стоимость в спасибках
    thanks_cost = (bonus_amount / 100) * statix_item.thanks_to_statix_rate
    
    # Получаем пользователя по Telegram ID (user_id здесь - это telegram_id)
    user = await get_user_by_telegram(db, user_id)
    if not user:
        raise ValueError("Пользователь не найден")
    
    # Проверяем, что у пользователя добавлена карта статикс
    if not user.card_barcode:
        raise ValueError("Для покупки бонусов Statix необходимо добавить карту статикс в профиль")
    
    # Проверяем баланс
    if user.balance < thanks_cost:
        raise ValueError("Недостаточно спасибок для покупки")
    
    # Подготавливаем данные для начисления бонусов
    formatted_phone = _normalize_statix_phone(user.phone_number)

    original_balance = user.balance

    try:
        # Списываем спасибки
        user.balance -= thanks_cost

        # Начисляем бонусы через Statix API
        await _send_statix_bonus_request(formatted_phone, bonus_amount, user.card_barcode)

        await db.commit()
        await db.refresh(user)
    except ValueError:
        await db.rollback()
        user.balance = original_balance
        raise
    except Exception as exc:
        await db.rollback()
        user.balance = original_balance
        logger.exception(
            "Неожиданная ошибка при начислении Statix бонусов (user_id=%s, phone=%s)",
            user_id,
            formatted_phone,
        )
        raise ValueError("Не удалось начислить бонусы Statix. Пожалуйста, попробуйте позже.") from exc
    else:
        logger.info(
            "Statix бонусы начислены: user_id=%s, phone=%s, bonus_points=%s",
            user_id,
            formatted_phone,
            bonus_amount,
        )
        
        # Отправляем уведомление администраторам
        try:
            admin_message = (
                f"🎁 <b>Покупка бонусов Statix!</b>\n\n"
                f"👤 <b>Пользователь:</b> {escape_html(user.first_name or '')} (@{escape_html(user.username or str(user.telegram_id))})\n"
                f"📞 <b>Телефон:</b> {escape_html(user.phone_number or 'не указан')}\n"
            )
            if user.email:
                admin_message += f"📧 <b>Почта:</b> {escape_html(user.email)}\n"
            admin_message += (
                f"💼 <b>Должность:</b> {escape_html(user.position or '')}\n\n"
                f"💰 <b>Куплено бонусов:</b> {bonus_amount}\n"
                f"💸 <b>Потрачено спасибок:</b> {thanks_cost}\n"
                f"📉 <b>Новый баланс:</b> {user.balance} спасибок"
            )
            
            await send_telegram_message(
                chat_id=settings.TELEGRAM_CHAT_ID,
                text=admin_message,
                message_thread_id=settings.TELEGRAM_PURCHASE_TOPIC_ID
            )
        except Exception as e:
            print(f"Could not send admin notification for Statix purchase. Error: {e}")
    
    return {
        "new_balance": user.balance,
        "purchased_bonus_amount": bonus_amount,
        "thanks_spent": thanks_cost
    }

# --- НОВАЯ ФУНКЦИЯ ДЛЯ ТЕСТИРОВАНИЯ ---
# (Она почти идентична generate_monthly_leaderboard_banners,
# но использует period='current_month')

async def generate_current_month_test_banners(db: AsyncSession):
    """
    Создает баннеры для Топ-3 ТЕКУЩЕГО месяца (для тестирования).
    Удаляет старые баннеры (типа 'leaderboard_...'), чтобы заменить их.
    """
    
    # 1. Удаляем все старые баннеры рейтинга (чтобы не было дублей)
    await db.execute(
        delete(models.Banner).where(
            models.Banner.banner_type.in_(['leaderboard_receivers', 'leaderboard_senders'])
        )
    )
    
    # 2. Получаем Топ-3 Получателей (за ТЕКУЩИЙ месяц)
    try:
        top_receivers_data = await get_leaderboard_data(
            db, 
            period='current_month', # <-- ГЛАВНОЕ ИЗМЕНЕНИЕ
            leaderboard_type='received'
        )
        
        top_3_receivers = [
            {
                "rank": i + 1,
                "first_name": item["user"].first_name,
                "last_name": item["user"].last_name,
                "telegram_photo_url": item["user"].telegram_photo_url,
                "total_received": item["total_received"]
            }
            for i, item in enumerate(top_receivers_data[:3])
        ]

        if top_3_receivers:
            receivers_banner = models.Banner(
                banner_type='leaderboard_receivers',
                position='main', 
                is_active=True,
                link_url='/leaderboard', 
                data={"users": top_3_receivers}
            )
            db.add(receivers_banner)
            print("TEST banner for receivers CREATED.")
        else:
            print("No data for TEST receivers banner (current_month).")

    except Exception as e:
        print(f"Failed to generate 'receivers' test banner: {e}")

    # 5. Получаем Топ-3 Отправителей (за ТЕКУЩИЙ месяц)
    try:
        top_senders_data = await get_leaderboard_data(
            db, 
            period='current_month', # <-- ГЛАВНОЕ ИЗМЕНЕНИЕ
            leaderboard_type='sent'
        )
        
        top_3_senders = [
            {
                "rank": i + 1,
                "first_name": item["user"].first_name,
                "last_name": item["user"].last_name,
                "telegram_photo_url": item["user"].telegram_photo_url,
                "total_received": item["total_received"] 
            }
            for i, item in enumerate(top_senders_data[:3])
        ]

        if top_3_senders:
            senders_banner = models.Banner(
                banner_type='leaderboard_senders',
                position='main',
                is_active=True,
                link_url='/leaderboard', 
                data={"users": top_3_senders}
            )
            db.add(senders_banner)
            print("TEST banner for senders CREATED.")
        else:
            print("No data for TEST senders banner (current_month).")

    except Exception as e:
        print(f"Failed to generate 'senders' test banner: {e}")

    await db.commit()
    print("TEST leaderboard banners generation finished.")

# --- ФУНКЦИИ ДЛЯ СОВМЕСТНЫХ ПОДАРКОВ ---

async def create_shared_gift_invitation(db: AsyncSession, invitation: schemas.CreateSharedGiftInvitationRequest):
    """Создать приглашение на совместный подарок"""
    # Проверяем, что товар существует и является совместным подарком
    item_result = await db.execute(
        select(models.MarketItem).where(models.MarketItem.id == invitation.item_id)
    )
    item = item_result.scalar_one_or_none()
    
    if not item:
        raise ValueError("Товар не найден")
    
    if not item.is_shared_gift:
        raise ValueError("Товар не является совместным подарком")
    
    # Проверяем, что приглашаемый пользователь существует
    invited_user_result = await db.execute(
        select(models.User).where(models.User.id == invitation.invited_user_id)
    )
    invited_user = invited_user_result.scalar_one_or_none()
    
    if not invited_user:
        raise ValueError("Приглашаемый пользователь не найден")
    
    # Проверяем, что покупатель существует
    buyer_result = await db.execute(
        select(models.User).where(models.User.id == invitation.buyer_id)
    )
    buyer = buyer_result.scalar_one_or_none()
    
    if not buyer:
        raise ValueError("Покупатель не найден")
    
    # Проверяем, что у покупателя достаточно средств
    if buyer.balance < item.price:
        raise ValueError("Недостаточно средств для покупки")
    
    # Списываем полную стоимость товара с покупателя
    buyer.balance -= item.price
    
    # Создаем приглашение с истечением через 24 часа
    expires_at = datetime.utcnow() + timedelta(hours=24)
    
    db_invitation = models.SharedGiftInvitation(
        buyer_id=invitation.buyer_id,
        invited_user_id=invitation.invited_user_id,
        item_id=invitation.item_id,
        expires_at=expires_at
    )
    
    db.add(db_invitation)
    await db.commit()
    await db.refresh(db_invitation)
    
    # Отправляем уведомление приглашенному пользователю
    try:
        # Игнорируем анонимизированных пользователей (telegram_id < 0)
        if invited_user.telegram_id and invited_user.telegram_id >= 0:
            await send_telegram_message(
                invited_user.telegram_id,
                f"🎁 <b>Приглашение на совместный подарок!</b>\n\n"
                f"👤 <b>{escape_html(buyer.first_name or '')} {escape_html(buyer.last_name or '')}</b> приглашает вас разделить товар <b>{escape_html(item.name)}</b>\n\n"
                f"💰 Стоимость будет разделена 50/50\n"
                f"⏰ Приглашение действует 24 часа",
                {
                    "inline_keyboard": [
                        [
                            {
                                "text": "✅ Принять",
                                "callback_data": f"accept_shared_gift_{db_invitation.id}"
                            },
                            {
                                "text": "❌ Отказаться", 
                                "callback_data": f"reject_shared_gift_{db_invitation.id}"
                            }
                        ]
                    ]
                }
            )
    except Exception as e:
        print(f"Failed to send shared gift invitation notification: {e}")
    
    return db_invitation

async def get_shared_gift_invitation(db: AsyncSession, invitation_id: int):
    """Получить приглашение на совместный подарок"""
    result = await db.execute(
        select(models.SharedGiftInvitation)
        .where(models.SharedGiftInvitation.id == invitation_id)
        .options(
            selectinload(models.SharedGiftInvitation.buyer),
            selectinload(models.SharedGiftInvitation.invited_user),
            selectinload(models.SharedGiftInvitation.item)
        )
    )
    return result.scalar_one_or_none()

async def accept_shared_gift_invitation(db: AsyncSession, invitation_id: int, user_id: int):
    """Принять приглашение на совместный подарок"""
    invitation = await get_shared_gift_invitation(db, invitation_id)
    
    if not invitation:
        raise ValueError("Приглашение не найдено")
    
    if invitation.invited_user_id != user_id:
        raise ValueError("Вы не можете принять это приглашение")
    
    if invitation.status != 'pending':
        raise ValueError("Приглашение уже обработано")
    
    if datetime.utcnow() > invitation.expires_at:
        # Приглашение истекло, возвращаем деньги покупателю
        await refund_shared_gift_purchase(db, invitation)
        raise ValueError("Приглашение истекло, средства возвращены")
    
    # Получаем данные покупателя и товара
    buyer_result = await db.execute(
        select(models.User).where(models.User.id == invitation.buyer_id)
    )
    buyer = buyer_result.scalar_one_or_none()
    
    item_result = await db.execute(
        select(models.MarketItem).where(models.MarketItem.id == invitation.item_id)
    )
    item = item_result.scalar_one_or_none()
    
    if not buyer or not item:
        raise ValueError("Ошибка получения данных")
    
    # Покупатель уже заплатил полную стоимость, ничего не возвращаем
    # Деление стоимости убрано - покупатель платит полную стоимость
    
    # Создаем покупку только для покупателя
    purchase_buyer = models.Purchase(
        user_id=invitation.buyer_id,
        item_id=invitation.item_id
    )
    db.add(purchase_buyer)
    
    # Приглашенный пользователь не получает покупку, так как не платит
    
    # Обновляем статус приглашения
    invitation.status = 'accepted'
    invitation.accepted_at = datetime.utcnow()
    
    # Уменьшаем остаток товара
    item.stock -= 1
    
    await db.commit()
    
    # Отправляем уведомление покупателю
    try:
        # Игнорируем анонимизированных пользователей (telegram_id < 0)
        if buyer.telegram_id and buyer.telegram_id >= 0:
            await send_telegram_message(
                buyer.telegram_id,
                f"✅ <b>Приглашение принято!</b>\n\n"
                f"👤 <b>{escape_html(invitation.invited_user.first_name or '')} {escape_html(invitation.invited_user.last_name or '')}</b> согласился разделить товар <b>{escape_html(item.name)}</b>\n\n"
                f"💰 Вам возвращена половина стоимости товара"
            )
    except Exception as e:
        print(f"Failed to send shared gift accepted notification: {e}")
    
    # Отправляем уведомление в админ-чат о совместной покупке
    try:
        admin_message = (
            f"🎁 <b>Совместная покупка в магазине!</b>\n\n"
            f"👤 <b>Покупатель:</b> {escape_html(buyer.first_name or '')} {escape_html(buyer.last_name or '')} (@{escape_html(buyer.username or str(buyer.telegram_id))})\n"
            f"📞 <b>Телефон покупателя:</b> {escape_html(buyer.phone_number or 'не указан')}\n"
        )
        if buyer.email:
            admin_message += f"📧 <b>Почта покупателя:</b> {escape_html(buyer.email)}\n"
        admin_message += (
            f"👥 <b>Приглашенный:</b> {escape_html(invitation.invited_user.first_name or '')} {escape_html(invitation.invited_user.last_name or '')} (@{escape_html(invitation.invited_user.username or str(invitation.invited_user.telegram_id))})\n"
            f"📞 <b>Телефон приглашенного:</b> {escape_html(invitation.invited_user.phone_number or 'не указан')}\n"
        )
        if invitation.invited_user.email:
            admin_message += f"📧 <b>Почта приглашенного:</b> {escape_html(invitation.invited_user.email)}\n"
        admin_message += (
            f"\n🎁 <b>Товар:</b> {escape_html(item.name)}\n"
            f"💰 <b>Стоимость:</b> {item.price} спасибок (оплачено покупателем)\n\n"
            f"📉 <b>Баланс покупателя:</b> {buyer.balance} спасибок"
        )
        
        await send_telegram_message(
            chat_id=settings.TELEGRAM_CHAT_ID,
            text=admin_message,
            message_thread_id=settings.TELEGRAM_PURCHASE_TOPIC_ID
        )
    except Exception as e:
        print(f"Failed to send shared gift admin notification: {e}")
    
    return {
        "message": "Приглашение принято успешно",
        "new_balance": buyer.balance
    }

async def reject_shared_gift_invitation(db: AsyncSession, invitation_id: int, user_id: int):
    """Отклонить приглашение на совместный подарок"""
    invitation = await get_shared_gift_invitation(db, invitation_id)
    
    if not invitation:
        raise ValueError("Приглашение не найдено")
    
    if invitation.invited_user_id != user_id:
        raise ValueError("Вы не можете отклонить это приглашение")
    
    if invitation.status != 'pending':
        raise ValueError("Приглашение уже обработано")
    
    # Обновляем статус приглашения
    invitation.status = 'rejected'
    invitation.rejected_at = datetime.utcnow()
    
    # Возвращаем деньги покупателю
    await refund_shared_gift_purchase(db, invitation)
    
    await db.commit()
    
    # Отправляем уведомление покупателю
    try:
        buyer_result = await db.execute(
            select(models.User).where(models.User.id == invitation.buyer_id)
        )
        buyer = buyer_result.scalar_one_or_none()
        
        item_result = await db.execute(
            select(models.MarketItem).where(models.MarketItem.id == invitation.item_id)
        )
        item = item_result.scalar_one_or_none()
        
        if buyer and item:
            # Игнорируем анонимизированных пользователей (telegram_id < 0)
            if buyer.telegram_id and buyer.telegram_id >= 0:
                await send_telegram_message(
                    buyer.telegram_id,
                    f"❌ <b>Приглашение отклонено</b>\n\n"
                    f"👤 <b>{escape_html(invitation.invited_user.first_name or '')} {escape_html(invitation.invited_user.last_name or '')}</b> отклонил приглашение на товар <b>{escape_html(item.name)}</b>\n\n"
                    f"💰 Вам возвращена полная стоимость товара"
                )
    except Exception as e:
        print(f"Failed to send shared gift rejected notification: {e}")
    
    return {
        "message": "Приглашение отклонено, средства возвращены"
    }

async def refund_shared_gift_purchase(db: AsyncSession, invitation: models.SharedGiftInvitation):
    """Возврат средств за совместный подарок"""
    buyer_result = await db.execute(
        select(models.User).where(models.User.id == invitation.buyer_id)
    )
    buyer = buyer_result.scalar_one_or_none()
    
    item_result = await db.execute(
        select(models.MarketItem).where(models.MarketItem.id == invitation.item_id)
    )
    item = item_result.scalar_one_or_none()
    
    if buyer and item:
        # Возвращаем полную стоимость товара (покупатель уже заплатил полную стоимость)
        buyer.balance += item.price

async def get_user_shared_gift_invitations(db: AsyncSession, user_id: int, status: str = None):
    """Получить приглашения пользователя на совместные подарки"""
    query = select(models.SharedGiftInvitation).where(
        or_(
            models.SharedGiftInvitation.buyer_id == user_id,
            models.SharedGiftInvitation.invited_user_id == user_id
        )
    )
    
    if status:
        query = query.where(models.SharedGiftInvitation.status == status)
    
    result = await db.execute(
        query.options(
            selectinload(models.SharedGiftInvitation.buyer),
            selectinload(models.SharedGiftInvitation.invited_user),
            selectinload(models.SharedGiftInvitation.item)
        )
    )
    return result.scalars().all()

async def cleanup_expired_shared_gift_invitations(db: AsyncSession):
    """Очистка истекших приглашений на совместные подарки"""
    now = datetime.utcnow()
    
    # Находим истекшие приглашения
    expired_invitations_result = await db.execute(
        select(models.SharedGiftInvitation).where(
            models.SharedGiftInvitation.status == 'pending',
            models.SharedGiftInvitation.expires_at < now
        )
    )
    expired_invitations = expired_invitations_result.scalars().all()
    
    # Возвращаем деньги за каждое истекшее приглашение
    for invitation in expired_invitations:
        await refund_shared_gift_purchase(db, invitation)
        invitation.status = 'expired'
        
        # Отправляем уведомление покупателю
        try:
            buyer_result = await db.execute(
                select(models.User).where(models.User.id == invitation.buyer_id)
            )
            buyer = buyer_result.scalar_one_or_none()
            
            item_result = await db.execute(
                select(models.MarketItem).where(models.MarketItem.id == invitation.item_id)
            )
            item = item_result.scalar_one_or_none()
            
            if buyer and item:
                # Игнорируем анонимизированных пользователей (telegram_id = -1)
                if buyer.telegram_id and buyer.telegram_id != -1:
                    await send_telegram_message(
                        buyer.telegram_id,
                        f"⏰ <b>Приглашение истекло</b>\n\n"
                        f"Время на принятие приглашения на товар <b>{escape_html(item.name)}</b> истекло\n\n"
                        f"💰 Вам возвращена полная стоимость товара"
                    )
        except Exception as e:
            print(f"Failed to send shared gift expired notification: {e}")
    
    await db.commit()
    return len(expired_invitations)
