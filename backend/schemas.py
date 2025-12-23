from pydantic import BaseModel, ConfigDict, field_serializer
from typing import Optional, List
from datetime import datetime, date

class OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

class MarketItemBase(OrmBase):
    id: int
    name: str
    description: Optional[str]
    price: int
    stock: int
    original_price: Optional[int] = None

class UserBase(OrmBase):
    id: int
    telegram_id: Optional[int] = None
    position: str
    first_name: Optional[str] = None
    last_name: str
    department: str
    username: Optional[str] = None

class PurchaseForUserResponse(OrmBase):
    id: int
    timestamp: datetime
    item: MarketItemBase

class PurchaseForMarketResponse(OrmBase):
    id: int
    timestamp: datetime
    user: UserBase

class UserResponse(UserBase):
    model_config = ConfigDict(
        from_attributes=True,
        # Оптимизация сериализации: используем mode='json' для лучшей производительности
        json_encoders={
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat() if v else None,
        },
        # Исключаем ненужные поля при сериализации для уменьшения размера ответа
        exclude_unset=True,
    )
    
    balance: int
    reserved_balance: int = 0
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
    email: Optional[str] = None
    has_seen_onboarding: bool
    has_interacted_with_bot: bool
    login: Optional[str] = None
    password_plain: Optional[str] = None  # Пароль в открытом виде (только для админов)
    browser_auth_enabled: bool = False

    @field_serializer('date_of_birth')
    def serialize_date(self, dob: Optional[date], _info):
        if dob is None:
            return None
        return dob.isoformat()

class ItemCodeResponse(OrmBase):
    id: int
    code_value: str
    is_issued: bool
        
class MarketItemResponse(OrmBase):
    id: int
    name: str
    description: Optional[str]
    price: int
    stock: int
    price_rub: int
    image_url: Optional[str] = None
    is_archived: bool
    original_price: Optional[int] = None
    is_auto_issuance: bool
    is_shared_gift: bool
    is_local_purchase: bool
    codes: List[ItemCodeResponse] = []

class LoginRequest(BaseModel):
    login: str  # Логин для входа
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class RegisterRequest(BaseModel):
    telegram_id: Optional[str] = None
    first_name: str
    last_name: str
    position: str
    department: str
    username: Optional[str] = None
    telegram_photo_url: Optional[str] = None
    phone_number: str
    date_of_birth: str
    email: Optional[str] = None

class FeedItem(OrmBase):
    id: int
    amount: int
    message: Optional[str]
    timestamp: datetime
    sender: UserBase
    receiver: UserBase

class LeaderboardItem(OrmBase):
    user: UserResponse
    total_received: int

class TransferRequest(BaseModel):
    sender_id: int
    receiver_id: int
    message: Optional[str] = None

class PurchaseRequest(BaseModel):
    user_id: int
    item_id: int
    
class LocalGiftRequest(BaseModel):
    user_id: int
    item_id: int
    city: str
    website_url: str
    
class PurchaseResponse(BaseModel):
    message: str
    new_balance: int
    issued_code: Optional[str] = None
    reserved_balance: Optional[int] = None
    
class MarketItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price_rub: int
    stock: int
    image_url: Optional[str] = None
    original_price: Optional[int] = None
    is_auto_issuance: bool = False
    is_shared_gift: bool = False
    is_local_purchase: bool = False
    codes_text: Optional[str] = None
    item_codes: Optional[List[str]] = []

class MarketItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_rub: Optional[int] = None
    stock: Optional[int] = None
    image_url: Optional[str] = None
    original_price: Optional[int] = None
    is_auto_issuance: Optional[bool] = None
    is_shared_gift: Optional[bool] = None
    is_local_purchase: Optional[bool] = None
    added_stock: Optional[int] = None
    new_item_codes: Optional[List[str]] = []

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

class AdminUserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[str] = None
    balance: Optional[int] = None
    tickets: Optional[int] = None
    ticket_parts: Optional[int] = None
    status: Optional[str] = None
    is_admin: Optional[bool] = None
    login: Optional[str] = None
    password: Optional[str] = None
    browser_auth_enabled: Optional[bool] = None

class BannerBase(OrmBase):
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    is_active: bool
    position: str
    banner_type: str = 'image'
    data: Optional[dict] = None

class BannerCreate(BannerBase):
    pass

class BannerUpdate(BaseModel):
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    is_active: Optional[bool] = None
    position: Optional[str] = None
    banner_type: Optional[str] = None
    data: Optional[dict] = None

class BannerResponse(BannerBase):
    id: int
    image_url: Optional[str]
    
    class Config:
        from_attributes = True

class RouletteWinResponse(OrmBase):
    id: int
    amount: int
    timestamp: datetime
    user: UserResponse

class SpinResponse(BaseModel):
    prize_won: int
    new_balance: int
    new_tickets: int

class MyRankResponse(BaseModel):
    rank: Optional[int]
    total_received: int
    total_participants: int

class GeneralStatsResponse(BaseModel):
    new_users_count: int
    transactions_count: int
    active_users_count: int
    total_turnover: int
    store_purchases_count: int
    total_store_spent: int

class HourlyActivityStats(BaseModel):
    hourly_stats: dict[int, int]

class UserEngagement(OrmBase):
    user: UserResponse
    count: int

class UserEngagementStats(BaseModel):
    top_senders: List['UserEngagement']
    top_receivers: List['UserEngagement']
    
class PopularItem(OrmBase):
    item: MarketItemResponse
    purchase_count: int
    
class PopularItemsStats(BaseModel):
    items: List['PopularItem']

class InactiveUsersStats(BaseModel):
    users: List[UserResponse]

class TotalBalanceStats(BaseModel):
    total_balance: int

class LoginActivityStats(BaseModel):
    hourly_stats: dict[int, int]

class ActiveUserRatioStats(BaseModel):
    active_users: int
    inactive_users: int

class SessionBase(OrmBase):
    user_id: int

class SessionResponse(SessionBase):
    id: int
    session_start: datetime
    last_seen: datetime

class AverageSessionDurationStats(BaseModel):
    average_duration_minutes: float

class StatixBonusItemResponse(OrmBase):
    id: int
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_active: bool
    thanks_to_statix_rate: int
    min_bonus_per_step: int
    max_bonus_per_step: int
    bonus_step: int
    created_at: datetime
    updated_at: datetime

class StatixBonusItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None
    thanks_to_statix_rate: Optional[int] = None
    min_bonus_per_step: Optional[int] = None
    max_bonus_per_step: Optional[int] = None
    bonus_step: Optional[int] = None

class StatixBonusPurchaseRequest(BaseModel):
    user_id: int
    bonus_amount: int  # Количество бонусов Statix для покупки

class StatixBonusPurchaseResponse(BaseModel):
    message: str
    new_balance: int
    purchased_bonus_amount: int

class SharedGiftInvitationResponse(OrmBase):
    id: int
    buyer_id: int
    invited_user_id: int
    item_id: int
    status: str
    created_at: datetime
    expires_at: datetime
    accepted_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    buyer: UserBase
    invited_user: UserBase
    item: MarketItemBase

class CreateSharedGiftInvitationRequest(BaseModel):
    buyer_id: int
    invited_user_id: int
    item_id: int

class AcceptSharedGiftRequest(BaseModel):
    invitation_id: int
    user_id: int

class RejectSharedGiftRequest(BaseModel):
    invitation_id: int
    user_id: int

class SharedGiftInvitationActionResponse(BaseModel):
    message: str
    new_balance: Optional[int] = None

class SetUserCredentialsRequest(BaseModel):
    login: str
    password: str

class SetUserCredentialsResponse(BaseModel):
    message: str
    login: str
    user_id: int

class ApproveUserRegistrationResponse(BaseModel):
    """Ответ при одобрении регистрации пользователя"""
    user: UserResponse
    login: Optional[str] = None  # Логин, если был сгенерирован
    password: Optional[str] = None  # Пароль, если был сгенерирован
    credentials_generated: bool = False  # Флаг, были ли сгенерированы учетные данные

class BulkSendCredentialsRequest(BaseModel):
    message: Optional[str] = ""
    include_active: bool = True
    include_blocked: bool = True
    regenerate_existing: bool = False

class BulkSendCredentialsResponse(BaseModel):
    message: str
    total_users: int
    credentials_generated: int
    messages_sent: int
    failed_users: List[int] = []

class LocalGiftResponse(OrmBase):
    id: int
    user_id: int
    item_id: int
    purchase_id: int
    city: str
    website_url: str
    status: str
    reserved_amount: int
    created_at: datetime
    updated_at: datetime
    user: UserBase
    item: MarketItemBase

class LocalGiftApprovalRequest(BaseModel):
    local_purchase_id: int  # Оставляем старое название поля для совместимости с БД
    action: str  # 'approve' или 'reject'

