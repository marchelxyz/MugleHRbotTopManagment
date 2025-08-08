# backend/schemas.py
from pydantic import BaseModel, ConfigDict, field_serializer
from typing import Optional, List
from datetime import datetime, date

class OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

# --- ИЗМЕНЕНИЕ №1: УНИФИЦИРУЕМ ТИПЫ ДЛЯ ЗАПРОСОВ ---
class RegisterRequest(BaseModel):
    telegram_id: int  # <-- Тип изменен на int для единообразия
    position: str
    last_name: str
    department: str
    username: Optional[str] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[date] = None # <-- Используем правильный тип date

class TransferRequest(BaseModel):
    sender_id: int
    receiver_id: int
    amount: int
    message: Optional[str] = None

class PurchaseRequest(BaseModel):
    user_id: int
    item_id: int

class UserUpdate(BaseModel):
    last_name: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[date] = None # <-- Используем правильный тип date

# --- ИЗМЕНЕНИЕ №2: НАСТРАИВАЕМ ПРАВИЛЬНЫЙ ОТВЕТ С СЕРВЕРА ---
class UserBase(OrmBase):
    id: int
    telegram_id: int
    position: str
    last_name: str
    department: str
    balance: int
    is_admin: bool = False
    username: Optional[str] = None
    photo_url: Optional[str] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[date] = None # <-- Тип соответствует базе данных

    # Этот "конвертер" гарантирует, что перед отправкой на фронтенд
    # объект date будет преобразован в безопасную строку "YYYY-MM-DD"
    @field_serializer('date_of_birth')
    def serialize_date(self, dob: Optional[date], _info):
        if dob is None:
            return None
        return dob.isoformat()

class UserResponse(UserBase):
    pass

# ... (остальные схемы без изменений) ...

class FeedItem(OrmBase):
    id: int
    sender_id: int
    receiver_id: int
    amount: int
    message: Optional[str]
    timestamp: datetime
    sender: UserBase
    receiver: UserBase

class LeaderboardItem(OrmBase):
    user: UserBase
    total_received: int

class MarketItemResponse(OrmBase):
    id: int
    name: str
    description: Optional[str]
    price: int
    stock: int

class PurchaseResponse(BaseModel):
    message: str
    new_balance: int

class MarketItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: int
    stock: int
