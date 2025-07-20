# backend/schemas.py
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# --- ИСПРАВЛЕНИЕ: МЕНЯЕМ orm_mode НА from_attributes ---
# Это уберет предупреждение из логов
class OrmBase(BaseModel):
    class Config:
        from_attributes = True

# Запросы
# RegisterRequest остается без изменений, так как ID приходит как строка
class RegisterRequest(BaseModel):
    telegram_id: str
    position: str
    last_name: str
    department: str

class TransferRequest(BaseModel):
    sender_id: int
    receiver_id: int
    amount: int
    message: Optional[str] = None

class PurchaseRequest(BaseModel):
    user_id: int
    item_id: int

# Ответы
# --- ИСПРАВЛЕНИЕ: ТЕПЕРЬ telegram_id - ЭТО ЧИСЛО ---
class UserBase(OrmBase): # Наследуемся от нашей новой базы
    id: int
    telegram_id: int # <-- Главное исправление
    position: str
    last_name: str
    department: str
    balance: int
    is_admin: bool = False

class UserResponse(UserBase):
    pass

class FeedItem(OrmBase): # Наследуемся от нашей новой базы
    id: int
    sender_id: int
    receiver_id: int
    amount: int
    message: Optional[str]
    timestamp: datetime
    sender: UserBase
    receiver: UserBase

class LeaderboardItem(OrmBase):
    user: UserBase # <-- Теперь здесь будет полный объект пользователя
    total_received: int

class MarketItemResponse(OrmBase): # Наследуемся от нашей новой базы
    id: int
    name: str
    description: Optional[str]
    price: int
    stock: int

# Схема для создания нового товара в магазине
class MarketItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: int
    stock: int

class PurchaseResponse(BaseModel):
    message: str
    new_balance: int
