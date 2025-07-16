# backend/app.py (Временная версия для диагностики №2)

import os
from pydantic import BaseModel
from fastapi import FastAPI, Depends, HTTPException, Header
from typing import Optional

# --- Приложение FastAPI ---
app = FastAPI(
    title="MugleHRbot API Diagnostics",
    description="Тестируем запуск приложения без подключения к БД.",
    version="1.2.0"
)

# --- ВРЕМЕННО УПРОЩЕННЫЕ ЭНДПОИНТЫ ---
# Мы не используем базу данных, а просто возвращаем тестовые данные.

@app.get("/")
def read_root():
    return {"message": "Основной код работает, база данных отключена."}

class UserResponse(BaseModel):
    """Временная схема для ответа"""
    telegram_id: int
    username: Optional[str]
    first_name: str
    position: str
    balance: int

@app.get("/users/me", response_model=UserResponse, summary="Проверить статус регистрации пользователя")
def check_user_status(x_telegram_id: int = Header(...)):
    """
    Эмулирует ответ "пользователь найден" без запроса к БД.
    """
    # Если мы дошли сюда, значит, приложение работает.
    # Для теста просто вернем фейкового пользователя.
    return {
        "telegram_id": x_telegram_id,
        "username": "testuser",
        "first_name": "Тестовый",
        "position": "Тестировщик",
        "balance": 999
    }

# --- ВЕСЬ КОД, СВЯЗАННЫЙ С БД, ВРЕМЕННО ОТКЛЮЧЕН ---

# import sqlalchemy...
# from dotenv import load_dotenv
# ...
# DATABASE_URL = os.getenv("DATABASE_URL", "...")
# engine = create_engine(DATABASE_URL)
# SessionLocal = sessionmaker(...)
# Base = declarative_base()
# ... модели User, Transaction ...
# Base.metadata.create_all(bind=engine)
# ... схемы Pydantic ...
# ... функция get_db() ...
# ... эндпоинт /auth/register ...
