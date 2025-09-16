# backend/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Основные настройки
    DATABASE_URL: str
    ADMIN_API_KEY: str
    
    # Настройки Telegram
    TELEGRAM_BOT_TOKEN: str
    TELEGRAM_CHAT_ID: int
    TELEGRAM_ADMIN_IDS: str 
    TELEGRAM_ADMIN_TOPIC_ID: int
    TELEGRAM_PURCHASE_TOPIC_ID: int
    TELEGRAM_UPDATE_TOPIC_ID: int
    TELEGRAM_ADMIN_LOG_TOPIC_ID: int

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
