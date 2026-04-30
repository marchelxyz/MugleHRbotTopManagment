from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator
from typing import Optional, List, Literal
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
    registration_date: Optional[datetime] = None

    @field_serializer('date_of_birth')
    def serialize_date(self, dob: Optional[date], _info):
        if dob is None:
            return None
        return dob.isoformat()

    @field_serializer('registration_date')
    def serialize_registration_date(self, val: Optional[datetime], _info):
        if val is None:
            return None
        return val.isoformat()


def user_response_for_public_api(user: object) -> UserResponse:
    """Убирает password_plain из ответов для клиента; у веб-заявки в pending скрывает и login."""
    u = UserResponse.model_validate(user)
    extra: dict = {"password_plain": None}
    tg = u.telegram_id
    is_web_pending = (u.status or "") == "pending" and (tg is None or tg < 0)
    if is_web_pending:
        extra["login"] = None
    return u.model_copy(update=extra)


def panel_admin_user_response(email: str) -> UserResponse:
    """Профиль для входа в админку по ADMIN_EMAILS + ADMIN_PANEL_PASSWORD (не строка в БД)."""
    normalized = email.strip().lower()
    return UserResponse(
        id=-1,
        telegram_id=None,
        position="—",
        first_name="Администратор",
        last_name="панели",
        department="—",
        username=None,
        balance=0,
        reserved_balance=0,
        daily_transfer_count=0,
        is_admin=True,
        status="approved",
        ticket_parts=0,
        tickets=0,
        card_barcode=None,
        card_balance=None,
        phone_number=None,
        date_of_birth=None,
        email=normalized or None,
        has_seen_onboarding=True,
        has_interacted_with_bot=False,
        login=None,
        password_plain=None,
        browser_auth_enabled=False,
        registration_date=None,
    )


class AdminPanelLoginRequest(BaseModel):
    """Тело POST /admin/auth/login."""

    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)


class AdminPanelLoginResponse(BaseModel):
    """Ответ после успешного входа в админ-панель по паролю."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class AdminPanelMeResponse(BaseModel):
    """Текущий админ-панельный пользователь по Bearer-токену."""

    user: UserResponse


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
    date_of_birth: Optional[str] = None
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
    email: Optional[str] = None

class ProfileUpdateRequest(BaseModel):
    last_name: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    phone_number: Optional[str] = None
    date_of_birth: Optional[str] = None
    email: Optional[str] = None

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
    email: Optional[str] = None
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

class ThemeSeasonAssets(BaseModel):
    """URL изображений для одной сезонной темы (пустые поля — дефолты из фронта)."""

    header_image_mobile: Optional[str] = None
    header_image_desktop: Optional[str] = None
    section_header_image: Optional[str] = None
    sidenav_logo: Optional[str] = None
    thanks_button: Optional[str] = None
    thanks_feed_logo: Optional[str] = None
    leaderboard_thanks_logo: Optional[str] = None


class ThemeAssetsPayload(BaseModel):
    summer: Optional[ThemeSeasonAssets] = None
    winter: Optional[ThemeSeasonAssets] = None


class AppSettingsResponse(OrmBase):
    id: int
    season_theme: Literal['summer', 'winter']
    theme_assets: Optional[ThemeAssetsPayload] = None


class AppSettingsUpdate(BaseModel):
    season_theme: Optional[Literal['summer', 'winter']] = None
    theme_assets: Optional[ThemeAssetsPayload] = None

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
    """Ответ при одобрении регистрации пользователя."""

    user: UserResponse
    login: Optional[str] = None
    password: Optional[str] = None
    credentials_generated: bool = False
    """True, если логин/пароль созданы в этом запросе (не были заранее у веб-заявки)."""

    credentials_active: bool = False
    """True, если вход в веб разрешён (данные активированы)."""

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

class BroadcastEmailRequest(BaseModel):
    """Рассылка одобренным пользователям: email, Telegram или оба канала.

    Если ``user_ids`` указан — рассылка ограничена этим списком (с учётом
    стандартных фильтров «есть валидный email» / «привязан Telegram»).
    """

    subject: str = Field(..., min_length=1, max_length=200)
    body: str = Field(..., min_length=1, max_length=20000)
    only_browser_users: bool = True
    append_login_url: bool = True
    send_email: bool = True
    send_telegram: bool = False
    user_ids: Optional[List[int]] = None

    @field_validator("subject", "body", mode="before")
    @classmethod
    def strip_whitespace(cls, v: object) -> str:
        if v is None:
            return ""
        return str(v).strip()

    @field_validator("subject")
    @classmethod
    def subject_no_newlines(cls, v: str) -> str:
        if "\n" in v or "\r" in v:
            raise ValueError("Тема письма не должна содержать переносы строк")
        return v

    @field_validator("user_ids")
    @classmethod
    def normalize_user_ids(cls, v):
        if v is None:
            return None
        ids = [int(x) for x in v if x is not None]
        ids = list(dict.fromkeys(ids))
        if not ids:
            raise ValueError(
                "Список user_ids пуст. Чтобы отправить всем, не передавайте поле"
            )
        return ids

    @model_validator(mode="after")
    def at_least_one_channel(self) -> "BroadcastEmailRequest":
        if not self.send_email and not self.send_telegram:
            raise ValueError("Выберите хотя бы один канал: email или Telegram")
        return self


class BroadcastEmailFailedItem(BaseModel):
    channel: Literal["email", "telegram"]
    target: str
    detail: str


class BroadcastRecipientReport(BaseModel):
    """Подробная запись о доставке для одного пользователя в одном канале.

    Поле ``reason`` — человекочитаемая русская формулировка (для UI и Excel),
    ``error_code`` — машинный код причины (для логики/группировки на фронте).
    """

    user_id: int
    channel: Literal["email", "telegram"]
    target: str
    name: str = ""
    first_name: str = ""
    last_name: str = ""
    department: str = ""
    position: str = ""
    phone: str = ""
    email: Optional[str] = None
    telegram_id: Optional[int] = None
    ok: bool = False
    skipped: bool = False
    skip_reason: Optional[str] = None
    error_code: Optional[str] = None
    reason: Optional[str] = None
    detail: Optional[str] = None


class BroadcastEmailResponse(BaseModel):
    message: str
    recipient_count_email: int = 0
    recipient_count_telegram: int = 0
    sent_ok_email: int = 0
    sent_ok_telegram: int = 0
    failed: List[BroadcastEmailFailedItem] = []
    recipients: List[BroadcastRecipientReport] = []


class BroadcastEmailPreviewResponse(BaseModel):
    recipient_count_email: int
    recipient_count_telegram: int


class BroadcastEligibleUser(BaseModel):
    """Кандидат на рассылку — для UI выбора получателей."""

    id: int
    first_name: str = ""
    last_name: str = ""
    email: Optional[str] = None
    telegram_id: Optional[int] = None
    department: str = ""
    position: str = ""
    browser_auth_enabled: bool = False
    email_available: bool = False
    telegram_available: bool = False
    telegram_no_dialog: bool = False


class BroadcastEligibleResponse(BaseModel):
    only_browser_users: bool
    users: List[BroadcastEligibleUser] = []
    total: int = 0
    available_email: int = 0
    available_telegram: int = 0
    telegram_no_dialog_count: int = 0


class BroadcastReportExportRequest(BaseModel):
    """Запрос на экспорт отчёта о рассылке в Excel.

    Сервер не хранит результаты последней рассылки между запросами, поэтому
    клиент возвращает в этот эндпоинт уже полученный отчёт целиком.
    """

    subject: str = ""
    sent_at: Optional[str] = None
    recipients: List[BroadcastRecipientReport] = []
    sent_ok_email: int = 0
    sent_ok_telegram: int = 0
    recipient_count_email: int = 0
    recipient_count_telegram: int = 0

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

class NotificationResponse(OrmBase):
    id: int
    user_id: int
    type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime

class NotificationListResponse(BaseModel):
    items: List['NotificationResponse']
    total: int
    unread_count: int

class UnifiedPurchaseResponse(BaseModel):
    id: int
    purchase_type: str
    user_name: str
    user_id: int
    item_name: str
    item_id: Optional[int] = None
    amount: int
    status: str
    created_at: datetime
    city: Optional[str] = None
    website_url: Optional[str] = None
    # Данные покупателя (как в сообщении в Telegram)
    phone_number: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    position: Optional[str] = None
    email: Optional[str] = None
    telegram_username: Optional[str] = None

class UnifiedPurchaseListResponse(BaseModel):
    items: List['UnifiedPurchaseResponse']
    total: int


class AdminMediaUploadResponse(BaseModel):
    """Ответ после загрузки изображения в объектное хранилище (конвертация в AVIF)."""

    url: str
    content_type: str = "image/avif"


class AdminMediaStatusResponse(BaseModel):
    """Доступность загрузки в S3-совместимое хранилище."""

    enabled: bool
