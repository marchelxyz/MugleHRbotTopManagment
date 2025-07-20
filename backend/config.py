from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Параметры из окружения
    DATABASE_URL: str
    ADMIN_API_KEY: str
    TELEGRAM_BOT_TOKEN: str
    TELEGRAM_ADMIN_CHAT_ID: int
    TELEGRAM_ADMIN_ID: int

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
