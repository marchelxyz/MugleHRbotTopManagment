from pydantic_settings import BaseSettings
from pydantic import AnyUrl

class Settings(BaseSettings):
    # Параметры из окружения
    DATABASE_URL: AnyUrl
    ADMIN_API_KEY: str
    TELEGRAM_BOT_TOKEN: str
    TELEGRAM_ADMIN_CHAT_ID: int

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
