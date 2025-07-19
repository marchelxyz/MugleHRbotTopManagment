python
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# Запросы
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
class UserBase(BaseModel):
    id: int
    telegram_id: str
    position: str
    last_name: str
    department: str
    balance: int

    class Config:
        orm_mode = True

class UserResponse(UserBase):
    pass

class FeedItem(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    amount: int
    message: Optional[str]
    timestamp: datetime

    sender: UserBase
    receiver: UserBase

    class Config:
        orm_mode = True

class LeaderboardItem(BaseModel):
    user_id: int
    total_received: int

class MarketItemResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    price: int
    stock: int

    class Config:
        orm_mode = True
