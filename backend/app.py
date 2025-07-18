import os
import logging
import httpx
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, BigInteger, func, desc
from sqlalchemy.orm import sessionmaker, relationship, declarative_base, Session
from sqlalchemy.exc import SQLAlchemyError
from pydantic import BaseModel
from fastapi import FastAPI, Depends, HTTPException, Header, Security
from typing import Optional, List
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from dateutil.relativedelta import relativedelta

# ... (Настройки логирования, БД, и модели User, Transaction остаются без изменений) ...
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "your_secret_admin_key") # Секретный ключ для админ. функций
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_ADMIN_CHAT_ID = os.getenv("TELEGRAM_ADMIN_CHAT_ID")

if not DATABASE_URL:
    raise Exception("Переменная окружения DATABASE_URL не установлена!")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(BigInteger, unique=True, index=True, nullable=False)
    username = Column(String, unique=True)
    first_name = Column(String, nullable=False)
    position = Column(String, nullable=False)
    balance = Column(Integer, default=100, nullable=False)
    sent_transactions = relationship("Transaction", foreign_keys="[Transaction.sender_id]", back_populates="sender")
    received_transactions = relationship("Transaction", foreign_keys="[Transaction.receiver_id]", back_populates="receiver")
    last_name = Column(String, nullable=True)
    department = Column(String, nullable=True)

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"))
    receiver_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Integer, nullable=False)
    message = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_transactions")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="received_transactions")

Base.metadata.create_all(bind=engine)

# --- Схемы данных Pydantic ---

class UserBase(BaseModel):
    telegram_id: int
    first_name: str
    position: str
    class Config: from_attributes = True

class UserResponse(UserBase):
    username: Optional[str]
    balance: int

# НОВАЯ СХЕМА для элемента ленты
class FeedItem(BaseModel):
    sender_name: str
    receiver_name: str
    amount: int
    message: str
    created_at: datetime
    class Config: from_attributes = True

# НОВАЯ СХЕМА для элемента рейтинга
class LeaderboardItem(BaseModel):
    user: UserBase
    total_points: int
    class Config: from_attributes = True

class RegisterRequest(BaseModel):
    first_name: str
    last_name: str # <--- НОВОЕ ПОЛЕ
    department: str # <--- НОВОЕ ПОЛЕ
    position: str
    username: Optional[str] = None
class TransferRequest(BaseModel):
    receiver_telegram_id: int; amount: int; message: str

# НОВАЯ МОДЕЛЬ для товаров в магазине
class MarketItem(Base):
    __tablename__ = "market_items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String)
    price = Column(Integer, nullable=False)
    quantity = Column(Integer, default=0) # Количество на складе

# НОВАЯ МОДЕЛЬ для истории покупок
class Purchase(Base):
    __tablename__ = "purchases"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    item_id = Column(Integer, ForeignKey("market_items.id"))
    price = Column(Integer, nullable=False)
    purchased_at = Column(DateTime(timezone=True), server_default=func.now())

# ... (создание таблиц)
Base.metadata.create_all(bind=engine)

class MarketItemResponse(BaseModel):
    id: int; name: str; description: Optional[str]; price: int; quantity: int
    class Config: from_attributes = True

class PurchaseRequest(BaseModel):
    item_id: int

# --- Новая функция для отправки уведомлений ---
async def send_telegram_notification(message: str):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_ADMIN_CHAT_ID:
        logger.warning("Переменные для Telegram не установлены. Уведомление не отправлено.")
        return
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_ADMIN_CHAT_ID,
        "text": message,
        "parse_mode": "Markdown"
    }
    async with httpx.AsyncClient() as client:
        try:
            await client.post(url, json=payload)
            logger.info("Уведомление администратору успешно отправлено.")
        except httpx.RequestError as e:
            logger.error(f"Ошибка отправки уведомления в Telegram: {e}")

app = FastAPI()
# ... (Настройка CORS остается без изменений) ...
origins = ["*"]
app.add_middleware(
    CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

def get_db():
    db = SessionLocal();
    try: yield db
    finally: db.close()

# --- Новые API Эндпоинты ---

# НОВЫЙ ЭНДПОИНТ для ленты
@app.get("/transactions/feed", response_model=List[FeedItem], summary="Получить ленту последних транзакций")
def get_transactions_feed(db: Session = Depends(get_db)):
    transactions = db.query(Transaction).order_by(desc(Transaction.created_at)).limit(20).all()
    feed = []
    for t in transactions:
        feed.append({
            "sender_name": t.sender.first_name,
            "receiver_name": t.receiver.first_name,
            "amount": t.amount,
            "message": t.message,
            "created_at": t.created_at
        })
    return feed

# НОВЫЙ ЭНДПОИНТ для рейтинга
@app.get("/leaderboard/last-month", response_model=List[LeaderboardItem], summary="Получить топ-3 за прошлый месяц")
def get_last_month_leaderboard(db: Session = Depends(get_db)):
    today = datetime.today()
    first_day_of_current_month = today.replace(day=1)
    last_day_of_last_month = first_day_of_current_month - relativedelta(days=1)
    first_day_of_last_month = last_day_of_last_month.replace(day=1)

    results = (
        db.query(
            Transaction.receiver_id,
            func.sum(Transaction.amount).label("total_points")
        )
        .filter(Transaction.created_at.between(first_day_of_last_month, last_day_of_last_month.replace(hour=23, minute=59, second=59)))
        .group_by(Transaction.receiver_id)
        .order_by(desc("total_points"))
        .limit(3)
        .all()
    )
    
    leaderboard = []
    for receiver_id, total_points in results:
        user = db.query(User).filter(User.id == receiver_id).first()
        if user:
            leaderboard.append({"user": user, "total_points": total_points})
            
    return leaderboard

# НОВЫЙ ЭНДПОИНТ для сброса баллов
@app.post("/admin/reset-balances", summary="Сбросить баланс всех пользователей до 100")
def reset_balances(admin_key: str = Header(...), db: Session = Depends(get_db)):
    if admin_key != ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Неверный ключ администратора.")
    
    db.query(User).update({User.balance: 100})
    db.commit()
    return {"message": "Баланс всех пользователей успешно сброшен до 100."}

@app.get("/")
def read_root(): return {"message": "API для HR бота успешно запущено и работает!"}

@app.get("/users", response_model=List[UserBase], summary="Получить список всех пользователей")
def get_all_users(x_telegram_id: int = Header(...), db: Session = Depends(get_db)):
    users = db.query(User).filter(User.telegram_id != x_telegram_id).all()
    return users

@app.get("/users/me", response_model=UserResponse)
def check_user_status(x_telegram_id: int = Header(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.telegram_id == x_telegram_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не зарегистрирован.")
    return user

@app.post("/auth/register", response_model=UserResponse, status_code=201)
def register_user(request: RegisterRequest, x_telegram_id: int = Header(...), db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.telegram_id == x_telegram_id).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Этот пользователь уже зарегистрирован.")
    new_user = User(
        telegram_id=x_telegram_id,
        first_name=request.first_name,
        username=request.username,
        position=request.position
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/points/transfer", summary="Перевести баллы другому пользователю")
def transfer_points(
    request: TransferRequest,
    x_telegram_id: int = Header(...),
    db: Session = Depends(get_db)
):
    if x_telegram_id == request.receiver_telegram_id:
        raise HTTPException(status_code=400, detail="Нельзя переводить баллы самому себе.")
    if request.amount <= 0:
        raise HTTPException(status_code=400, detail="Количество баллов должно быть положительным.")
    if not request.message or len(request.message.strip()) == 0:
        raise HTTPException(status_code=400, detail="Комментарий не может быть пустым.")

    sender = db.query(User).filter(User.telegram_id == x_telegram_id).first()
    receiver = db.query(User).filter(User.telegram_id == request.receiver_telegram_id).first()

    if not sender:
        raise HTTPException(status_code=404, detail="Отправитель не найден.")
    if not receiver:
        raise HTTPException(status_code=404, detail="Получатель не найден.")
    if sender.balance < request.amount:
        raise HTTPException(status_code=400, detail="Недостаточно баллов для перевода.")

    sender.balance -= request.amount
    receiver.balance += request.amount

    new_transaction = Transaction(
        sender_id=sender.id,
        receiver_id=receiver.id,
        amount=request.amount,
        message=request.message.strip()
    )
    db.add(new_transaction)
    db.commit()

    return {"message": "Баллы успешно переведены!"}

# НОВЫЙ ЭНДПОИНТ для получения списка товаров
@app.get("/market/items", response_model=List[MarketItemResponse])
def get_market_items(db: Session = Depends(get_db)):
    return db.query(MarketItem).filter(MarketItem.quantity > 0).all()

# НОВЫЙ ЭНДПОИНТ для покупки товара
@app.post("/market/purchase")
async def purchase_item(request: PurchaseRequest, x_telegram_id: int = Header(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.telegram_id == x_telegram_id).first()
    item = db.query(MarketItem).filter(MarketItem.id == request.item_id).first()

    if not user or not item:
        raise HTTPException(status_code=404, detail="Пользователь или товар не найден.")
    if item.quantity <= 0:
        raise HTTPException(status_code=400, detail="Товар закончился.")
    if user.balance < item.price:
        raise HTTPException(status_code=400, detail="Недостаточно баллов для покупки.")

    # Проведение транзакции
    user.balance -= item.price
    item.quantity -= 1
    
    new_purchase = Purchase(user_id=user.id, item_id=item.id, price=item.price)
    db.add(new_purchase)
    db.commit()

    # Формирование и отправка уведомления
    notification_message = (
        f"🛍️ *Новая покупка!*\n\n"
        f"👤 *Сотрудник:* {user.first_name} {user.last_name}\n"
        f"✉️ *Тег:* @{user.username}\n"
        f"🏢 *Подразделение:* {user.department}\n"
        f"👔 *Должность:* {user.position}\n\n"
        f"🎁 *Товар:* {item.name}\n"
        f"💰 *Остаток баллов:* {user.balance}"
    )
    await send_telegram_notification(notification_message)
    
    return {"message": "Покупка совершена успешно!", "new_balance": user.balance}
