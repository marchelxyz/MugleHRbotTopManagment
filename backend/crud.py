# backend/crud.py
from sqlalchemy.future import select
from sqlalchemy import func, update 
from sqlalchemy.ext.asyncio import AsyncSession
import models, schemas
from bot import send_telegram_message
from database import settings
from datetime import datetime, timedelta, date

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
    # Теперь можно просто вернуть объекты SQLAlchemy,
    # Pydantic сам преобразует их согласно response_model в роутере.
    result = await db.execute(select(models.MarketItem))
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
