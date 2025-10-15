# backend/schemas.py
from pydantic import BaseModel, ConfigDict, field_serializer
from typing import Optional, List
from datetime import datetime, date

class OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

# --- ИЗМЕНЕНИЕ: Базовая схема для товара ---
class MarketItemBase(OrmBase):
    id: int
    name: str
    description: Optional[str]
    price: int # Цена в спасибках для отображения пользователю
    stock: int
    original_price: Optional[int] = None # <-- ДОБАВЬ СЮДА

# Базовая схема для пользователя (без связей)
class UserBase(OrmBase):
    id: int
    telegram_id: Optional[int] = None
    position: str
    first_name: Optional[str] = None
    last_name: str
    department: str
    username: Optional[str] = None

# Схема для Покупки, которая НЕ содержит обратно Товар
class PurchaseForUserResponse(OrmBase):
    id: int
    timestamp: datetime
    item: MarketItemBase # <-- Используем базовую схему товара

# Схема для Покупки, которая НЕ содержит обратно Пользователя
class PurchaseForMarketResponse(OrmBase):
    id: int
    timestamp: datetime
    user: UserBase # <-- Используем базовую схему пользователя

# Финальная схема для Пользователя, которая включает его покупки
class UserResponse(UserBase):
    balance: int
    daily_transfer_count: int
    is_admin: bool
    status: Optional[str] = 'approved' 
    telegram_photo_url: Optional[str] = None
    ticket_parts: int
    tickets: int
    card_barcode: Optional[str] = None
    card_balance: Optional[str] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    has_seen_onboarding: bool
    # purchases: List[PurchaseForUserResponse] = [] # Раскомментируйте, если понадобится

    @field_serializer('date_of_birth')
    def serialize_date(self, dob: Optional[date], _info):
        if dob is None:
            return None
        return dob.isoformat()

# --- 1. ДОБАВЬ ЭТУ НОВУЮ СХЕМУ ДЛЯ ОПИСАНИЯ КОДА ---
class ItemCodeResponse(OrmBase):
    id: int
    code_value: str
    is_issued: bool
        
# --- ИЗМЕНЕНИЕ: Финальная схема ответа для API ---
# Она будет включать все поля для удобства
class MarketItemResponse(OrmBase):
    id: int
    name: str
    description: Optional[str]
    price: int
    stock: int
    price_rub: int
    image_url: Optional[str] = None
    is_archived: bool
    original_price: Optional[int] = None # <-- Теперь это поле гарантированно будет в ответе
    is_auto_issuance: bool
    codes: List[ItemCodeResponse] = []

# --- ОСТАЛЬНЫЕ СХЕМЫ (адаптируем под новые базовые) ---

class RegisterRequest(BaseModel):
    telegram_id: str
    first_name: str # Добавляем это поле
    last_name: str
    position: str
    department: str
    username: Optional[str] = None
    telegram_photo_url: Optional[str] = None
    phone_number: str
    date_of_birth: str

class FeedItem(OrmBase):
    id: int
    amount: int
    message: Optional[str]
    timestamp: datetime
    sender: UserBase    # <-- Используем базовую схему
    receiver: UserBase # <-- Используем базовую схему

class LeaderboardItem(OrmBase):
    user: UserResponse # <-- Используем полную схему пользователя
    total_received: int

# ... (остальные схемы запросов остаются без изменений)
class TransferRequest(BaseModel):
    sender_id: int
    receiver_id: int
    message: Optional[str] = None

class PurchaseRequest(BaseModel):
    user_id: int
    item_id: int
    
class PurchaseResponse(BaseModel):
    message: str
    new_balance: int
    issued_code: Optional[str] = None
    
# --- ИЗМЕНЕНИЕ: Схема для СОЗДАНИЯ товара (принимаем только рубли) ---
class MarketItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price_rub: int
    stock: int
    image_url: Optional[str] = None
    original_price: Optional[int] = None
    is_auto_issuance: bool = False
    codes_text: Optional[str] = None # Поле для вставки кодов (каждый с новой строки)
    item_codes: Optional[List[str]] = []

# --- ИЗМЕНЕНИЕ: Схема для ОБНОВЛЕНИЯ товара (принимаем только рубли) ---
class MarketItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_rub: Optional[int] = None
    stock: Optional[int] = None
    image_url: Optional[str] = None
    original_price: Optional[int] = None # <-- И СЮДА
    is_auto_issuance: Optional[bool] = None
    # --- НАШИ НОВЫЕ ПОЛЯ ---
    added_stock: Optional[int] = None # Для пополнения обычных товаров
    new_item_codes: Optional[List[str]] = [] # Для добавления новых кодов/ссылок

class UserUpdate(BaseModel):
    last_name: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[str] = None

class ProfileUpdateRequest(BaseModel):
    last_name: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[str] = None

# --- НОВАЯ СХЕМА ДЛЯ РЕДАКТИРОВАНИЯ ПОЛЬЗОВАТЕЛЯ АДМИНОМ ---
class AdminUserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    # phone_number дублировался, я оставил один
    phone_number: Optional[str] = None
    date_of_birth: Optional[str] = None
    balance: Optional[int] = None
    tickets: Optional[int] = None
    ticket_parts: Optional[int] = None
    status: Optional[str] = None # Позволяем менять статус ('approved', 'blocked')
    is_admin: Optional[bool] = None

class BannerBase(OrmBase):
    image_url: str
    link_url: Optional[str] = None
    is_active: bool
    position: str

class BannerCreate(BannerBase):
    pass

class BannerUpdate(BaseModel):
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    is_active: Optional[bool] = None
    position: Optional[str] = None

class BannerResponse(BannerBase):
    id: int

# --- НОВЫЕ СХЕМЫ ДЛЯ РУЛЕТКИ ---
class RouletteWinResponse(OrmBase):
    id: int
    amount: int
    timestamp: datetime
    user: UserResponse # Используем полную схему данных

class SpinResponse(BaseModel):
    prize_won: int
    new_balance: int
    new_tickets: int

# --- НОВАЯ СХЕМА ДЛЯ ОТВЕТА О РАНГЕ ПОЛЬЗОВАТЕЛЯ ---
class MyRankResponse(BaseModel):
    rank: Optional[int]
    total_received: int
    total_participants: int

# --- СХЕМА ДЛЯ СТАТИСТИКИ ---
class GeneralStatsResponse(BaseModel):
    new_users_count: int
    transactions_count: int
    active_users_count: int
    total_turnover: int
    store_purchases_count: int
    total_store_spent: int

# --- НАШИ НОВЫЕ СХЕМЫ ДЛЯ РАСШИРЕННОЙ СТАТИСТИКИ ---

class HourlyActivityStats(BaseModel):
    hourly_stats: dict[int, int]

class UserEngagement(OrmBase):
    user: UserResponse  # Используем твою основную схему UserResponse
    count: int

class UserEngagementStats(BaseModel):
    top_senders: List['UserEngagement']
    top_receivers: List['UserEngagement']
    
class PopularItem(OrmBase):
    item: MarketItemResponse # Используем твою основную схему MarketItemResponse
    purchase_count: int
    
class PopularItemsStats(BaseModel):
    items: List['PopularItem']

class InactiveUsersStats(BaseModel):
    users: List[UserResponse] # Возвращаем список полных профилей

class TotalBalanceStats(BaseModel):
    total_balance: int

# --- Обновление ссылок в конце файла ---
# Важно! Pydantic v2 (который ты используешь) умнее и сам обрабатывает большинство 
# forward references. Явный вызов .model_rebuild() часто не нужен, если структура
# не слишком сложная (как у тебя). Я убрал эти вызовы, так как они, скорее всего,
# и были источником последней ошибки. Код станет чище и должен работать.

class LoginActivityStats(BaseModel):
    hourly_stats: dict[int, int]

class ActiveUserRatioStats(BaseModel):
    active_users: int
    inactive_users: int

# --- НОВЫЕ СХЕМЫ ДЛЯ СЕССИЙ ---

class SessionBase(OrmBase):
    user_id: int

class SessionResponse(SessionBase):
    id: int
    session_start: datetime
    last_seen: datetime

class AverageSessionDurationStats(BaseModel):
    average_duration_minutes: float
