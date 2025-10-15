# backend/crud.py
import io
import zipfile
import json
import math 
from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session, selectinload
import random
import bot
import config
from sqlalchemy.future import select
from sqlalchemy.orm import aliased
from sqlalchemy import select, func, update, delete, extract
from sqlalchemy.ext.asyncio import AsyncSession
import models, schemas
from config import settings
from bot import send_telegram_message
from database import settings
from datetime import datetime, timedelta, date
from sqlalchemy import or_
from sqlalchemy import text
from sqlalchemy import select

# Пользователи
async def get_user(db: AsyncSession, user_id: int):
    result = await db.execute(select(models.User).where(models.User.id == user_id))
    return result.scalars().first()

async def get_user_by_telegram(db: AsyncSession, telegram_id: int):
    result = await db.execute(select(models.User).where(models.User.telegram_id == telegram_id))
    return result.scalars().first()

async def create_user(db: AsyncSession, user: schemas.RegisterRequest):
    user_telegram_id = int(user.telegram_id)
    
    admin_ids_str = settings.TELEGRAM_ADMIN_IDS
    admin_ids = [int(id.strip()) for id in admin_ids_str.split(',')]
    is_admin = user_telegram_id in admin_ids
    
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
            message_thread_id=settings.TELEGRAM_ADMIN_TOPIC_ID
        )
    except Exception as e:
        print(f"FAILED to send admin notification. Error: {e}")
    
    return db_user

async def get_users(db: AsyncSession):
    result = await db.execute(select(models.User))
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
        message_text = (f"🎉 Вам начислена *1* спасибка!\n"
                        f"От: *{sender.first_name} {sender.last_name}*\n"
                        f"Сообщение: _{tr.message}_")
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
        time_filter = f"WHERE transactions.timestamp BETWEEN '{start_str}' AND '{end_str}'"

    # --- НАЧАЛО ИСПРАВЛЕНИЙ ---
    raw_sql = text(f"""
        WITH ranked_users AS (
            SELECT
                u.id as user_id,
                SUM(t.amount) as total_amount,
                RANK() OVER (ORDER BY SUM(t.amount) DESC) as rank
            FROM users u
            JOIN transactions t ON u.id = t.{group_by_field}
            {time_filter.replace('transactions.', 't.')}
            GROUP BY u.id
        ),
        total_participants AS (
            SELECT COUNT(DISTINCT {group_by_field}) as count FROM transactions {time_filter}
        )
        SELECT ru.rank, ru.total_amount, tp.count
        FROM ranked_users ru, total_participants tp
        WHERE ru.user_id = :user_id
    """)
    # --- КОНЕЦ ИСПРАВЛЕНИЙ ---

    result = await db.execute(raw_sql, {"user_id": user_id})
    user_rank_data = result.first()

    if not user_rank_data:
        total_participants_sql = text(f"SELECT COUNT(DISTINCT {group_by_field}) as count FROM transactions {time_filter}")
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
    result = await db.execute(select(models.MarketItem))
    return result.scalars().all()

async def get_active_items(db: AsyncSession):
    result = await db.execute(
        select(models.MarketItem)
        .where(models.MarketItem.is_archived == False)
        # --- ИЗМЕНЕНИЕ №1: Используем 'codes' ---
        .options(selectinload(models.MarketItem.codes)) 
    )
    items = result.scalars().all()
    
    for item in items:
        if item.is_auto_issuance:
            # --- ИЗМЕНЕНИЕ №2: Используем 'codes' и здесь ---
            available_codes = sum(1 for code in item.codes if not code.is_issued)
            item.stock = available_codes
            
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
    
# backend/crud.py

# backend/crud.py

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

    if item.is_auto_issuance:
        stmt = (
            select(models.ItemCode)
            .where(models.ItemCode.market_item_id == item.id, models.ItemCode.is_issued == False)
            .limit(1)
            .with_for_update()
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

    # --- ФИНАЛЬНАЯ ВЕРСИЯ УВЕДОМЛЕНИЙ ---
    try:
        # Уведомление для администратора (без изменений)
        admin_message = (
            f"🛍️ *Новая покупка в магазине!*\n\n"
            f"👤 *Пользователь:* {user.first_name} (@{user.username or user.telegram_id})\n"
            f"💼 *Должность:* {user.position}\n\n"
            f"🎁 *Товар:* {item.name}\n"
            f"💰 *Стоимость:* {item.price} спасибок"
        )
        if issued_code_value:
            admin_message += (
                f"\n\n✨ *Товар с автовыдачей*\n"
                f"🔑 *Выданный код:* `{issued_code_value}`"
            )
        admin_message += f"\n\n📉 *Новый баланс пользователя:* {user.balance} спасибок"
        
        await send_telegram_message(
            chat_id=settings.TELEGRAM_CHAT_ID,
            text=admin_message,
            message_thread_id=settings.TELEGRAM_PURCHASE_TOPIC_ID
        )

        # Уведомление для пользователя (теперь для всех покупок)
        user_message = f"🎉 Поздравляем с покупкой \"{item.name}\"!"
        if issued_code_value:
            # Для товаров с кодом добавляем сам код
            user_message += f"\n\nВаш уникальный код/ссылка:\n`{issued_code_value}`"
        
        await send_telegram_message(chat_id=user.telegram_id, text=user_message)

    except Exception as e:
        print(f"Could not send notification. Error: {e}")

    await db.commit()
    
    return {"new_balance": user.balance, "issued_code": issued_code_value}
    
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
    """Начисляет 15 баллов всем, у кого сегодня день рождения."""
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
        # Можно добавить отправку поздравительного сообщения в ТГ
    
    # --- ДОБАВИТЬ ЭТИ ДВЕ СТРОКИ ---
    await reset_ticket_parts(db)
    await reset_tickets(db)
    
    await db.commit()
    return len(users)

# --- ДОБАВЬТЕ ЭТУ НОВУЮ ФУНКЦИЮ В КОНЕЦ ФАЙЛА ---
async def update_user_status(db: AsyncSession, user_id: int, status: str):
    """Обновляет статус пользователя."""
    result = await db.execute(select(models.User).where(models.User.id == user_id))
    user = result.scalars().first()
    if user:
        user.status = status
        await db.commit()
        await db.refresh(user)
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
    if item.is_auto_issuance and item.codes_text:
        # Получаем коды из текстового поля, убираем пустые строки
        codes = [code.strip() for code in item.codes_text.splitlines() if code.strip()]
        # Если коды предоставлены, количество на складе равно количеству кодов
        stock = len(codes)
    else:
        stock = item.stock

    db_item = models.MarketItem(
        name=item.name,
        description=item.description,
        price=calculated_price, 
        price_rub=item.price_rub,
        stock=stock, # Используем рассчитанный или указанный сток
        image_url=item.image_url,
        original_price=item.original_price,
        is_auto_issuance=item.is_auto_issuance
    )
    
    # Если есть коды, создаем для них записи в новой таблице
    if codes:
        for code_value in codes:
            db_code = models.ItemCode(code_value=code_value, market_item=db_item)
            db.add(db_code)

    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item

async def admin_update_market_item(db: AsyncSession, item_id: int, item_data: schemas.MarketItemUpdate):
    db_item = await db.get(models.MarketItem, item_id)
    if not db_item:
        return None

    # Обновляем основные данные товара
    update_data = item_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        # Исключаем наши новые поля, чтобы не было ошибок
        if key not in ["added_stock", "new_item_codes"]:
            setattr(db_item, key, value)

    # Логика для обычных товаров: добавляем к текущему остатку
    if not db_item.is_auto_issuance and item_data.added_stock is not None and item_data.added_stock > 0:
        db_item.stock += item_data.added_stock

    # Логика для автовыдачи: добавляем новые уникальные коды
    if db_item.is_auto_issuance and item_data.new_item_codes:
        for code_value in item_data.new_item_codes:
            new_code = models.ItemCode(code_value=code_value.strip(), market_item_id=db_item.id)
            db.add(new_code)
        # Обновляем общий сток (на случай если он был неверный)
        current_codes_count = await db.scalar(select(func.count(models.ItemCode.id)).where(models.ItemCode.market_item_id == db_item.id))
        db_item.stock = current_codes_count


    await db.commit()
    await db.refresh(db_item)
    return db_item
    
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
    result = await db.execute(select(models.MarketItem).where(models.MarketItem.is_archived == True))
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
    """Собирает части билетиков в целые билеты (2 к 1)."""
    user = await db.get(models.User, user_id)
    if not user or user.ticket_parts < 3:
        raise ValueError("Недостаточно частей для сборки билета.")
    
    new_tickets = user.ticket_parts // 3
    user.tickets += new_tickets
    user.ticket_parts %= 3 # Оставляем остаток (0 или 1)
    
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

# --- ДОБАВЬТЕ ЭТИ НОВЫЕ ФУНКЦИИ В КОНЕЦ ФАЙЛА ---

async def process_pkpass_file(db: AsyncSession, user_id: int, file_content: bytes):
    """
    Обрабатывает файл .pkpass, извлекает данные и СИНХРОНИЗИРУЕТ
    имя и фамилию пользователя с данными карты.
    """
    user = await db.get(models.User, user_id)
    if not user:
        return None

    try:
        with zipfile.ZipFile(io.BytesIO(file_content), 'r') as pass_zip:
            pass_json_bytes = pass_zip.read('pass.json')
            pass_data = json.loads(pass_json_bytes)
            
            # --- 1. Извлекаем все нужные данные ---
            
            # Штрих-код (как и раньше)
            barcode_data = pass_data.get('barcode', {}).get('message')
            if not barcode_data:
                raise ValueError("Barcode data not found in pass.json")

            # Баланс (как и раньше)
            card_balance = "0"
            header_fields = pass_data.get('storeCard', {}).get('headerFields', [])
            for field in header_fields:
                if field.get('key') == 'field0': # Судя по файлу, ключ баланса 'field0'
                    card_balance = str(field.get('value'))
                    break
            
            # --- 2. НАЧАЛО НОВОЙ ЛОГИКИ: Извлекаем Имя и Фамилию ---
            full_name_from_card = None
            auxiliary_fields = pass_data.get('storeCard', {}).get('auxiliaryFields', [])
            for field in auxiliary_fields:
                # Ищем поле, где label "Владелец карты"
                if field.get('label') == 'Владелец карты':
                    full_name_from_card = field.get('value')
                    break

            # --- 3. Обновляем профиль пользователя, если имя найдено ---
            if full_name_from_card:
                # Делим "Виктория Никулина" на ["Виктория", "Никулина"]
                name_parts = full_name_from_card.split()
                first_name_from_card = name_parts[0] if len(name_parts) > 0 else ""
                last_name_from_card = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

                # Сравниваем и обновляем, если есть расхождения
                if user.first_name != first_name_from_card and first_name_from_card:
                    user.first_name = first_name_from_card
                if user.last_name != last_name_from_card and last_name_from_card:
                    user.last_name = last_name_from_card
            
            # --- 4. Сохраняем данные карты в профиль ---
            user.card_barcode = barcode_data
            user.card_balance = card_balance
            
            await db.commit()
            await db.refresh(user)
            return user
            
    except Exception as e:
        print(f"Error processing pkpass file: {e}")
        return None

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
        f"👤 *Запрос на смену данных от:* @{user.username or user.first_name} ({user.last_name})\n"
    ]
    
    for key, new_val in actual_new_data.items():
        old_val = old_data.get(key)
        field_name = key.replace('_', ' ').capitalize()
        message_lines.append(f"*{field_name}*:\n  ↳ Старое: `{old_val or 'не указано'}`\n  ↳ Новое: `{new_val or 'не указано'}`\n")

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
    Ищет пользователей по частичному совпадению в имени, фамилии или юзернейме.
    Поиск регистронезависимый.
    """
    if not query:
        return []
    
    # Создаем шаблон для поиска "внутри" строки (например, "ан" найдет "Иван")
    search_query = f"%{query}%"
    
    result = await db.execute(
        select(models.User).filter(
            or_(
                models.User.first_name.ilike(search_query),
                # Если у тебя есть поле last_name, раскомментируй строку ниже
                # models.User.last_name.ilike(search_query),
                models.User.username.ilike(search_query)
            )
        ).limit(20) # Ограничиваем вывод, чтобы не возвращать тысячи пользователей
    )
    return result.scalars().all()

# --- НАЧАЛО: НОВЫЕ ФУНКЦИИ ДЛЯ АДМИН-ПАНЕЛИ УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ ---

async def get_all_users_for_admin(db: AsyncSession):
    """Получает всех пользователей для админ-панели."""
    result = await db.execute(select(models.User).order_by(models.User.last_name))
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
        else:
            setattr(user, key, new_value)
    
    # Отправляем уведомление, только если были реальные изменения
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

    # 2. Затираем личные данные пользователя
    user_to_anonymize.first_name = "Удаленный"
    user_to_anonymize.last_name = "Пользователь"
    user_to_anonymize.telegram_id = None  # <-- Требует изменений в базе данных, которые мы обсуждали
    user_to_anonymize.username = None       # <-- Требует изменений в базе данных, которые мы обсуждали
    user_to_anonymize.phone_number = None
    user_to_anonymize.telegram_photo_url = None
    user_to_anonymize.is_admin = False
    user_to_anonymize.status = "deleted" # Меняем статус, чтобы скрыть его из списков

    # 3. Сохраняем изменения в базе
    db.add(user_to_anonymize)
    await db.commit()

    # 4. Отправляем уведомление об анонимизации
    log_message = (
        f"🗑️ *Админ анонимизировал пользователя*\n\n"
        f"👤 *Администратор:* {admin_name} (`{admin_user.id}`)\n"
        f"🎯 *Бывший пользователь:* {target_user_name} (`{user_id}`)\n\n"
        f"Личные данные пользователя стерты, история транзакций сохранена."
    )
    
    await bot.send_telegram_message(
        chat_id=config.settings.TELEGRAM_CHAT_ID,
        text=log_message,
        message_thread_id=config.settings.TELEGRAM_ADMIN_LOG_TOPIC_ID
    )

    # 5. Возвращаем измененный (теперь анонимный) объект пользователя
    return user_to_anonymize

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
        
    query_total_users = select(func.count(models.User.id)).where(models.User.status != 'deleted')
    total_users = (await db.execute(query_total_users)).scalar_one()

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
        "new_users_count": total_users,
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
    if end_date is None: end_date = datetime.utcnow().date()
    if start_date is None: start_date = end_date - timedelta(days=365*5)
    end_date_inclusive = end_date + timedelta(days=1)

    query = (
        select(models.MarketItem, func.count(models.Purchase.id).label('purchase_count'))
        .join(models.Purchase, models.MarketItem.id == models.Purchase.item_id, isouter=True)
        .filter(models.Purchase.timestamp.between(start_date, end_date_inclusive))
        .group_by(models.MarketItem.id).order_by(func.count(models.Purchase.id).desc()).limit(limit)
    )
    return (await db.execute(query)).all()

async def get_inactive_users(db: AsyncSession, start_date: Optional[date] = None, end_date: Optional[date] = None):
    start_date, end_date_inclusive = _prepare_dates(start_date, end_date)

    active_senders_q = select(models.Transaction.sender_id).filter(models.Transaction.timestamp.between(start_date, end_date_inclusive)).distinct()
    active_recipients_q = select(models.Transaction.receiver_id).filter(models.Transaction.timestamp.between(start_date, end_date_inclusive)).distinct()
    
    active_senders = (await db.execute(active_senders_q)).scalars().all()
    active_recipients = (await db.execute(active_recipients_q)).scalars().all()
    
    active_user_ids = set(active_senders).union(set(active_recipients))
    
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
