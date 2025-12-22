from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    ADMIN_API_KEY: str
    
    TELEGRAM_BOT_TOKEN: str
    TELEGRAM_CHAT_ID: int
    TELEGRAM_ADMIN_IDS: str 
    TELEGRAM_ADMIN_TOPIC_ID: int
    TELEGRAM_PURCHASE_TOPIC_ID: int
    TELEGRAM_UPDATE_TOPIC_ID: int
    TELEGRAM_ADMIN_LOG_TOPIC_ID: int

    # Настройки интеграции со Statix Bonus
    STATIX_BONUS_API_URL: str = "https://cabinet.statix-pro.ru/webhooks/custom/muggle_rest.php"
    STATIX_BONUS_ACTION: str = "add_bonus_points"
    STATIX_BONUS_LOGIN: str = "customer331"
    STATIX_BONUS_PASSWORD: str = "qd905xA_DI"
    STATIX_BONUS_RESTAURANT_NAME: str = "TG BOT"
    STATIX_BONUS_TIMEOUT_SECONDS: int = 10

    # Настройки Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = ""
    REDIS_URL: str = ""

    # Настройки Unisender для отправки email
    UNISENDER_API_KEY: str = ""
    UNISENDER_API_URL: str = "https://api.unisender.com/ru/api"
    UNISENDER_SENDER_NAME: str = ""
    UNISENDER_SENDER_EMAIL: str = ""
    UNISENDER_ADMIN_EMAIL: str = ""  # Email для уведомлений администраторам
    UNISENDER_LIST_ID: str = ""  # Опционально: ID списка рассылки

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
