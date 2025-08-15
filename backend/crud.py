# backend/crud.py
from sqlalchemy.future import select
from sqlalchemy import func, update
from sqlalchemy.orm import noload
from sqlalchemy.ext.asyncio import AsyncSession
import models, schemas

# Пользователи
async def get_user(db: AsyncSession, user_id: int):
    result = await db.execute(select(models.User).where(models.User.id == user_id))
    return result.scalars().first()

async def get_user_by_telegram(db: AsyncSession, telegram_id: int):
    result = await db.execute(select(models.User).where(models.User.telegram_id == telegram_id))
    return result.scalars().first()

async def create_user(db: AsyncSession, user: schemas.RegisterRequest):
    user_telegram_id = int(user.telegram_id)
    is_admin = (user_telegram_id == settings.TELEGRAM_ADMIN_ID)
    
    # --- ИЗМЕНЕНИЕ: ПРАВИЛЬНОЕ ПРЕОБРАЗОВАНИЕ ДАТЫ ---
    dob = None
    if user.date_of_birth and user.date_of_birth.strip():
        try:
            # Преобразуем строку "YYYY-MM-DD" в объект date
            dob = date.fromisoformat(user.date_of_birth)
        except (ValueError, TypeError):
            # Если формат даты неверный или пустой, оставляем None
            dob = None

    db_user = models.User(
        telegram_id=user_telegram_id,
        position=user.position,
        last_name=user.last_name,
        department=user.department,
        username=user.username,
        is_admin=is_admin,
        phone_number=user.phone_number,
        date_of_birth=dob
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
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

    # Выбираем отправителя и получателя с блокировкой FOR UPDATE
    # Это гарантирует, что никто другой не сможет изменить эти строки, пока транзакция не завершится
    sender_stmt = select(models.User).where(models.User.id == tr.sender_id).with_for_update()
    receiver_stmt = select(models.User).where(models.User.id == tr.receiver_id).with_for_update()

    sender_result = await db.execute(sender_stmt)
    sender = sender_result.scalars().first()
    
    receiver_result = await db.execute(receiver_stmt)
    receiver = receiver_result.scalars().first()

    if not sender or not receiver:
        raise ValueError("Sender or Receiver not found")
        
    # Теперь эта проверка абсолютно надежна
    if sender.balance < tr.amount:
        raise ValueError("Insufficient balance")

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
    """
    Получает список всех товаров из магазина.
    """
    # 1. Выполняем простой запрос к базе, чтобы получить объекты товаров
    result = await db.execute(select(models.MarketItem))
    items_from_db = result.scalars().all()

    # 2. КЛЮЧЕВОЙ ШАГ: Вручную создаем "плоский" список данных для ответа.
    # Этот метод полностью исключает возможность возникновения бесконечного цикла,
    # так как мы передаем не объекты с их связями, а простые данные.
    items_for_response = [
        {
            "id": item.id,
            "name": item.name,
            "description": item.description,
            "price": item.price,
            "stock": item.stock,
        }
        for item in items_from_db
    ]

    return items_for_response

async def create_market_item(db: AsyncSession, item: schemas.MarketItemCreate):
    # ... (эта функция остается без изменений)
    db_item = models.MarketItem(**item.model_dump())
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    return db_item
    
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
    db_purchase = models.Purchase(user_id=pr.user_id, item_id=pr.item_id)
    db.add(db_purchase)
    
    # --- НАЧАЛО ИЗМЕНЕНИЙ: Уведомление для пользователя ---
    try:
        user_message = (
            f"✅ *Покупка совершена!*\n\n"
            f"Вы приобрели: *{item.name}*.\n"
            f"С вашего баланса списано *{item.price}* баллов.\n"
            f"Ваш новый баланс: *{user.balance}* баллов."
        )
        await send_telegram_message(chat_id=user.telegram_id, text=user_message)
    except Exception as e:
        print(f"Could not send purchase notification to user {user.telegram_id}. Error: {e}")
    # --- КОНЕЦ ИЗМЕНЕНИЙ ---
    
    # Существующее уведомление для администратора (остается без изменений)
    try:
        admin_message = (
            f"🛍️ *Новая покупка в магазине!*\n\n"
            f"👤 *Пользователь:* {user.last_name} (@{user.username or user.telegram_id})\n"
            f"💼 *Должность:* {user.position}\n\n"
            f"🎁 *Товар:* {item.name}\n"
            f"💰 *Стоимость:* {item.price} баллов\n\n"
            f"📉 *Новый баланс пользователя:* {user.balance} баллов"
        )
        await send_telegram_message(chat_id=settings.TELEGRAM_CHAT_ID, text=admin_message)
    except Exception as e:
        print(f"Could not send admin notification. Error: {e}")

    await db.commit()
    return user.balance
# Админ
async def add_points_to_all_users(db: AsyncSession, amount: int):
    await db.execute(update(models.User).values(balance=models.User.balance + amount))
    await db.commit()
    return True

async def reset_balances(db: AsyncSession):
    await db.execute(update(models.User).values(balance=0))
    await db.commit()
    return True
