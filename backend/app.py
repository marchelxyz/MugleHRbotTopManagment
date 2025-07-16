# backend/app.py (Финальная диагностическая версия)
import os
import logging
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import sessionmaker, relationship, declarative_base, Session
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.sql import func
from pydantic import BaseModel
from fastapi import FastAPI, Depends, HTTPException, Header
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

logger.info("Загрузка конфигурации базы данных...")
DATABASE_URL = os.getenv("DATABASE_URL")
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
    telegram_id = Column(Integer, unique=True, index=True, nullable=False)
    username = Column(String, unique=True)
    first_name = Column(String, nullable=False)
    position = Column(String, nullable=False)
    balance = Column(Integer, default=100, nullable=False)

Base.metadata.create_all(bind=engine)

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
    class Config: { "from_attributes": True }

app = FastAPI()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root(): return {"message": "API для HR бота успешно запущено!"}

@app.get("/users/me", response_model=UserResponse)
def check_user_status(x_telegram_id: int = Header(...), db: Session = Depends(get_db)):
    logger.info(f"--- НАЧАЛО ПРОВЕРКИ /users/me для telegram_id: {x_telegram_id} ---")
    user = db.query(User).filter(User.telegram_id == x_telegram_id).first()

    if not user:
        logger.warning(f"Пользователь с telegram_id: {x_telegram_id} НЕ НАЙДЕН в базе. Возвращаю ошибку 404.")
        raise HTTPException(status_code=404, detail="Пользователь не зарегистрирован.")

    logger.info(f"Пользователь с telegram_id: {x_telegram_id} НАЙДЕН. Данные: {user.__dict__}")
    return user

@app.post("/auth/register", response_model=UserResponse, status_code=201)
def register_user(request: RegisterRequest, x_telegram_id: int = Header(...), db: Session = Depends(get_db)):
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
