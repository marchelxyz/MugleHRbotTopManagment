import os
import logging
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import sessionmaker, relationship, declarative_base
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.sql import func
from pydantic import BaseModel
# ВОТ ИСПРАВЛЕНИЕ: Мы импортируем Session отсюда
from sqlalchemy.orm import Session
from fastapi import FastAPI, Depends, HTTPException, Header
from typing import Optional

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Конфигурация базы данных
logger.info("Загрузка конфигурации базы данных...")
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    logger.error("Переменная окружения DATABASE_URL не установлена!")
    raise Exception("Переменная окружения DATABASE_URL не установлена!")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    logger.info("DATABASE_URL был преобразован для совместимости с SQLAlchemy.")

engine = None
try:
    logger.info("Попытка подключения к базе данных...")
    engine = create_engine(DATABASE_URL)
    with engine.connect() as connection:
        logger.info("Подключение к базе данных успешно установлено!")
except SQLAlchemyError as e:
    logger.error(f"Ошибка подключения к базе данных: {e}")
    raise

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Модели Базы Данных
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(Integer, unique=True, index=True, nullable=False)
    username = Column(String, unique=True)
    first_name = Column(String, nullable=False)
    position = Column(String, nullable=False)
    balance = Column(Integer, default=100, nullable=False)

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"))
    receiver_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Integer, nullable=False)
    message = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

logger.info("Создание таблиц в базе данных (если их нет)...")
Base.metadata.create_all(bind=engine)
logger.info("Проверка таблиц завершена.")

# Схемы данных Pydantic
class RegisterRequest(BaseModel):
    first_name: str
    username: Optional[str] = None
    position: str

class UserResponse(BaseModel):
    telegram_id: int
    username: Optional[str]
    first_name: str
    position: str
    balance: int
    class Config:
        from_attributes = True

# Приложение FastAPI
app = FastAPI(
    title="MugleHRbot API",
    description="API для peer-to-peer баллов.",
    version="2.1.0"
)

# Вспомогательные функции
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# API Эндпоинты
@app.get("/")
def read_root():
    return {"message": "API для HR бота успешно запущено и работает!"}

@app.get("/users/me", response_model=UserResponse, summary="Проверить статус регистрации пользователя")
def check_user_status(x_telegram_id: int = Header(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.telegram_id == x_telegram_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не зарегистрирован.")
    return user

@app.post("/auth/register", response_model=UserResponse, status_code=201, summary="Зарегистрировать нового пользователя")
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

logger.info("Приложение FastAPI полностью сконфигурировано и готово к работе.")
