import os
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import sessionmaker, relationship, declarative_base
from sqlalchemy.sql import func
from pydantic import BaseModel
from fastapi import FastAPI, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from typing import Optional

# --- Конфигурация ---

# Загружаем переменные окружения из файла .env (для локальной разработки)
load_dotenv()

# URL для подключения к PostgreSQL из переменных окружения
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@host:port/dbname")

# Создаем "движок" для подключения к базе данных
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# --- Модели Базы Данных (Таблицы) ---

class User(Base):
    """Модель сотрудника"""
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(Integer, unique=True, index=True, nullable=False)
    username = Column(String, unique=True)
    first_name = Column(String, nullable=False)
    position = Column(String, nullable=False) # Должность теперь обязательна
    balance = Column(Integer, default=100, nullable=False) # Стартовый баланс

class Transaction(Base):
    """Модель транзакции баллов"""
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"))
    receiver_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Integer, nullable=False)
    message = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# Создаем таблицы в базе данных при запуске, если их нет
Base.metadata.create_all(bind=engine)


# --- Схемы данных Pydantic (для валидации) ---

class RegisterRequest(BaseModel):
    """Схема данных для запроса на регистрацию"""
    first_name: str
    username: Optional[str] = None
    position: str # Поле для должности

class UserResponse(BaseModel):
    """Схема для ответа с данными пользователя"""
    telegram_id: int
    username: Optional[str]
    first_name: str
    position: str
    balance: int
    class Config:
        from_attributes = True # В Pydantic v2 orm_mode переименован

# --- Приложение FastAPI ---

app = FastAPI(
    title="MugleHRbot API",
    description="API для peer-to-peer баллов с регистрацией.",
    version="1.1.0"
)

# --- Вспомогательные функции ---

def get_db():
    """Функция для получения сессии базы данных"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- API Эндпоинты (Маршруты) ---

@app.get("/users/me", response_model=UserResponse, summary="Проверить статус регистрации пользователя")
def check_user_status(
    x_telegram_id: int = Header(...),
    db: Session = Depends(get_db)
):
    """
    Проверяет, зарегистрирован ли пользователь.
    Ожидает Telegram ID в заголовке запроса `X-Telegram-Id`.
    """
    user = db.query(User).filter(User.telegram_id == x_telegram_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не зарегистрирован.")
    return user

@app.post("/auth/register", response_model=UserResponse, status_code=201, summary="Зарегистрировать нового пользователя")
def register_user(
    request: RegisterRequest,
    x_telegram_id: int = Header(...),
    db: Session = Depends(get_db)
):
    """
    Регистрирует нового пользователя в системе.
    Проверяет, не занят ли уже этот Telegram ID.
    """
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
