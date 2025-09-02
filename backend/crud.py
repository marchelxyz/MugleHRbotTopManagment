# backend/crud.py
import math # Добавьте этот импорт вверху
from datetime import datetime # Добавьте этот импорт вверху
from sqlalchemy.future import select
from sqlalchemy import func, update 
from sqlalchemy.ext.asyncio import AsyncSession
import models, schemas
from bot import send_telegram_message
from database import settings
from datetime import datetime, timedelta, date
import random # Добавьте этот импорт
from dateutil.relativedelta import relativedelta # Добавьте этот импорт

# Пользователи
async def get_user(db: AsyncSession, user_id: int):
    result = await db.execute(select(models.User).where(models.User.id == user_id))
    return result.scalars().first()

async def get_user_by_telegram(db: AsyncSession, telegram_id: int):
    result = await db.execute(select(models.User).where(models.User.telegram_id == telegram_id))
    return result.scalars().first()

async def create_user(db: AsyncSession, user: schemas.RegisterRequest):
    user_telegram_id = int(user.telegram_id)
    
    # --- ИЗМЕНЕНИЕ: Новая логика проверки на админа ---
    # 1. Получаем строку с ID из настроек: "727331113,12345678"
    admin_ids_str = settings.TELEGRAM_ADMIN_IDS
    # 2. Превращаем строку в список чисел: [727331113, 12345678]
    admin_ids = [int(id.strip()) for id in admin_ids_str.split(',')]
    # 3. Проверяем, есть ли ID пользователя в этом списке
    is_admin = user_telegram_id in admin_ids
    # --- КОНЕЦ ИЗМЕНЕНИЙ ---
    
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

    if sender.last_login_date < today:
        sender.daily_transfer_count = 0
        sender.last_login_date = today
    
    # --- Новые лимиты ---
    fixed_amount = 1 # Сумма перевода теперь всегда 1
    if sender.daily_transfer_count >= 3: # Лимит - 3 перевода в день
        raise ValueError("Дневной лимит переводов исчерпан (3 в день)")

    receiver = await db.get(models.User, tr.receiver_id)
    if not receiver:
        raise ValueError("Получатель не найден")

    # Увеличиваем счетчик и начисляем на основной баланс получателя
    sender.daily_transfer_count += 1
    receiver.balance += fixed_amount
    
    db_tr = models.Transaction(
        sender_id=tr.sender_id,
        receiver_id=tr.receiver_id,
        amount=fixed_amount,
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
            f"👤 *Пользователь:* {user.last_name} (@{user.username or user.telegram_id})\n"
            f"💼 *Должность:* {user.position}\n\n"
            f"🎁 *Товар:* {item.name}\n"
            f"💰 *Стоимость:* {item.price} баллов\n\n"
            f"📉 *Новый баланс пользователя:* {new_balance} баллов"
        )
        await send_telegram_message(chat_id=settings.TELEGRAM_CHAT_ID, text=admin_message)
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
    """Начисляет 300 баллов всем, у кого сегодня день рождения."""
    today = date.today()
    users_with_birthday = await db.execute(
        select(models.User).where(
            func.extract('month', models.User.date_of_birth) == today.month,
            func.extract('day', models.User.date_of_birth) == today.day
        )
    )
    users = users_with_birthday.scalars().all()
    
    for user in users:
        user.balance += 300
        # Можно добавить отправку поздравительного сообщения в ТГ
        
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
    """Создает новый товар с расчетом цены в спасибках."""
    price_spasibki = calculate_spasibki_price(item.price_rub)
    db_item = models.MarketItem(
        name=item.name,
        description=item.description,
        price_rub=item.price_rub,
        price=price_spasibki,
        stock=item.stock,
        is_archived=False
    )
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item

async def admin_update_market_item(db: AsyncSession, item_id: int, item_data: schemas.MarketItemUpdate):
    """Обновляет товар, пересчитывая цену, если нужно."""
    db_item = await db.get(models.MarketItem, item_id)
    if not db_item: return None
    update_data = item_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_item, key, value)
    if 'price_rub' in update_data:
        db_item.price = calculate_spasibki_price(update_data['price_rub'])
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

# --- ИЗМЕНЕНИЕ: Добавляем начисление части билетика при переводе ---
async def create_transaction(db: AsyncSession, tr: schemas.TransferRequest):
    # ... (код до sender.daily_transfer_count += 1)
    sender.daily_transfer_count += 1
    # --- НАЧАЛО ДОБАВЛЕНИЙ ---
    sender.ticket_parts += 1 # Начисляем 1 часть билетика за перевод
    # --- КОНЕЦ ДОБАВЛЕНИЙ ---
    receiver.balance += fixed_amount
    # ... (остальной код функции)

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
    """Прокручивает рулетку, рассчитывает и начисляет выигрыш."""
    user = await db.get(models.User, user_id)
    if not user or user.tickets < 1:
        raise ValueError("Недостаточно билетов для прокрутки.")

    user.tickets -= 1

    # Логика взвешенного шанса
    rand = random.random() # Случайное число от 0.0 до 1.0
    if rand < 0.05: # 5% шанс
        prize = random.randint(16, 30)
    elif rand < 0.35: # 30% шанс (0.05 + 0.30)
        prize = random.randint(6, 15)
    else: # 65% шанс
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
