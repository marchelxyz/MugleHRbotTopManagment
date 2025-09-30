# backend/crud.py
import io
import zipfile
import json
import math # Добавьте этот импорт вверху
import random
from sqlalchemy.future import select
from sqlalchemy import func, update 
from sqlalchemy.ext.asyncio import AsyncSession
import models, schemas
from bot import send_telegram_message
from database import settings
from datetime import datetime, timezone, timedelta  # <--- ИЗМЕНЕНИЕ: Добавляем timezone и timedelta
from sqlalchemy import or_
from sqlalchemy import text

# --- ДОБАВЛЕНИЕ: Создаем объект часового пояса для Москвы ---
MSK = timezone(timedelta(hours=3), 'Europe/Moscow')

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
        # --- ДОБАВЬ ЭТУ СТРОКУ ---
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
    if sender.last_login_date is None or sender.last_login_date < today:
        sender.daily_transfer_count = 0
        sender.last_login_date = today
    
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
    """Получает список активных товаров для магазина."""
    result = await db.execute(select(models.MarketItem).where(models.MarketItem.is_archived == False))
    return result.scalars().all()

async def create_market_item(db: AsyncSession, item: schemas.MarketItemCreate):
    db_item = models.MarketItem(**item.model_dump())
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    
    return {
        "id": db_item.id, "name": db_item.name, "description": db_item.description,
        "price": db_item.price, "stock": db_item.stock,
    }
    
async def create_purchase(db: AsyncSession, pr: schemas.PurchaseRequest):
    # 1. Получаем пользователя и товар, как и раньше
    item = await db.get(models.MarketItem, pr.item_id)
    user = await db.get(models.User, pr.user_id)

    if not item or not user:
        raise ValueError("Item or User not found")
    if item.stock <= 0:
        raise ValueError("Item out of stock")
    if user.balance < item.price:
        raise ValueError("Insufficient balance")

    # 2. Вместо изменения объектов, мы создаем явные запросы на обновление
    new_balance = user.balance - item.price
    
    # Запрос на обновление баланса пользователя
    user_update_stmt = (
        update(models.User)
        .where(models.User.id == pr.user_id)
        .values(balance=new_balance)
    )
    # Запрос на уменьшение остатка товара
    item_update_stmt = (
        update(models.MarketItem)
        .where(models.MarketItem.id == pr.item_id)
        .values(stock=models.MarketItem.stock - 1)
    )

    # Выполняем оба запроса
    await db.execute(user_update_stmt)
    await db.execute(item_update_stmt)

    # 3. Создаем запись о покупке, как и раньше
    db_purchase = models.Purchase(user_id=pr.user_id, item_id=pr.item_id)
    db.add(db_purchase)
    
    # 4. Отправляем уведомления (эта часть не меняется)
    try:
        admin_message = (
            f"🛍️ *Новая покупка в магазине!*\n\n"
            f"👤 *Пользователь:* {user.first_name} (@{user.username or user.telegram_id})\n"
            f"💼 *Должность:* {user.position}\n\n"
            f"🎁 *Товар:* {item.name}\n"
            f"💰 *Стоимость:* {item.price} баллов\n\n"
            f"📉 *Новый баланс пользователя:* {new_balance} баллов"
        )
        # Стало (добавляем ID топика для покупок):
        await send_telegram_message(
            chat_id=settings.TELEGRAM_CHAT_ID, 
            text=admin_message,
            message_thread_id=settings.TELEGRAM_PURCHASE_TOPIC_ID
        )
        # --- КОНЕЦ ИЗМЕНЕНИЙ ---
    except Exception as e:
        print(f"Could not send admin notification. Error: {e}")

    # 5. Сохраняем все изменения в базе данных
    await db.commit()
    
    # 6. Возвращаем новый баланс
    return new_balance
    
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
    return round(price_rub / 50)

def calculate_accumulation_forecast(price_spasibki: int) -> str:
    """Рассчитывает примерный прогноз накопления."""
    # Это очень упрощенная модель, основанная на ваших примерах.
    # Предполагаем, что средний пользователь получает около 1000 спасибок в месяц.
    months_needed = price_spasibki / 15
    
    if months_needed <= 1:
        return "около 1 месяца"
    elif months_needed <= 18: # до 1.5 лет
        return f"около {round(months_needed)} мес."
    else:
        years = round(months_needed / 12, 1)
        return f"около {years} лет"

# Мы переименуем старую функцию create_market_item
async def admin_create_market_item(db: AsyncSession, item: schemas.MarketItemCreate):
    # Рассчитываем 'price' на основе 'price_rub'
    calculated_price = item.price_rub // 50
    db_item = models.MarketItem(
        name=item.name,
        description=item.description,
        price=calculated_price, 
        price_rub=item.price_rub,
        stock=item.stock,
        image_url=item.image_url  # <-- ВОТ ДОБАВЛЕННАЯ СТРОКА
    )

    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item

async def admin_update_market_item(db: AsyncSession, item_id: int, item_update: schemas.MarketItemUpdate):
    db_item = await db.get(models.MarketItem, item_id)
    if db_item:
        if item_update.name is not None:
            db_item.name = item_update.name
        if item_update.description is not None:
            db_item.description = item_update.description
        if item_update.price_rub is not None:
            db_item.price_rub = item_update.price_rub
            db_item.price = item_update.price_rub // 50
        if item_update.stock is not None:
            db_item.stock = item_update.stock

        # <-- НАЧАЛО ДОБАВЛЕННОГО БЛОКА -->
        if item_update.image_url is not None:
            db_item.image_url = item_update.image_url
        # <-- КОНЕЦ ДОБАВЛЕННОГО БЛОКА -->

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

# --- НОВЫЕ ФУНКЦИИ ДЛЯ РУЛЕТКИ ---

async def assemble_tickets(db: AsyncSession, user_id: int):
    """Собирает части билетиков в целые билеты (2 к 1)."""
    user = await db.get(models.User, user_id)
    if not user or user.ticket_parts < 2:
        raise ValueError("Недостаточно частей для сборки билета.")
    
    new_tickets = user.ticket_parts // 2
    user.tickets += new_tickets
    user.ticket_parts %= 2 # Оставляем остаток (0 или 1)
    
    await db.commit()
    await db.refresh(user)
    return user

async def spin_roulette(db: AsyncSession, user_id: int):
    """
    Прокручивает рулетку, рассчитывает и начисляет выигрыш на основе чисел от 1 до 30.
    """
    user = await db.get(models.User, user_id)
    if not user or user.tickets < 1:
        raise ValueError("Недостаточно билетов для прокрутки.")

    user.tickets -= 1

    # Логика взвешенного шанса для чисел от 1 до 30
    rand = random.random()
    if rand < 0.05: # 5% шанс на крупный выигрыш
        prize = random.randint(16, 30)
    elif rand < 0.35: # 30% шанс на средний выигрыш
        prize = random.randint(6, 15)
    else: # 65% шанс на малый выигрыш
        prize = random.randint(1, 5)

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
        
        await send_telegram_message(
            chat_id=settings.TELEGRAM_CHAT_ID,
            text=log_message,
            message_thread_id=settings.TELEGRAM_ADMIN_LOG_TOPIC_ID
        )
    else:
        # Если изменений не было, ничего не сохраняем и не отправляем
        pass

    return user

# --- ЗАМЕНИ ЭТУ ФУНКЦИЮ ---
async def admin_delete_user(db: AsyncSession, user_id: int, admin_user: models.User):
    """
    "Жесткое" удаление: полностью удаляет пользователя из базы данных.
    """
    user = await get_user(db, user_id)
    if not user:
        return False
    
    target_user_name = f"@{user.username}" if user.username else f"{user.first_name} {user.last_name}"
    admin_name = f"@{admin_user.username}" if admin_user.username else f"{admin_user.first_name} {admin_user.last_name}"

    # --- ГЛАВНОЕ ИЗМЕНЕНИЕ: Полностью удаляем пользователя ---
    await db.delete(user)
    await db.commit()

    # Отправляем уведомление об удалении
    log_message = (
        f"🗑️ *Админ удалил пользователя*\n\n"
        f"👤 *Администратор:* {admin_name}\n"
        f"🎯 *Пользователь:* {target_user_name}\n\n"
        f"Запись пользователя была полностью удалена из системы."
    )
    await send_telegram_message(
        chat_id=settings.TELEGRAM_CHAT_ID,
        text=log_message,
        message_thread_id=settings.TELEGRAM_ADMIN_LOG_TOPIC_ID
    )

    return True

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
