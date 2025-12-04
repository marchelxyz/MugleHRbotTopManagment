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

    # Настройки интеграции со Statix Bonus
    STATIX_BONUS_API_URL: str = "https://cabinet.statix-pro.ru/webhooks/custom/muggle_rest.php"
    STATIX_BONUS_ACTION: str = "add_bonus_points"
    STATIX_BONUS_LOGIN: str = "customer331"
    STATIX_BONUS_PASSWORD: str = "qd905xA_DI"
    STATIX_BONUS_RESTAURANT_NAME: str = "TG BOT"
    STATIX_BONUS_TIMEOUT_SECONDS: int = 10
    
    # Настройки JWT для аутентификации через браузер
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"  # В production должен быть сложным случайным ключом
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 дней

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
# --- ДОБАВЛЯЕМ ЭТУ СТРОКУ В КОНЕЦ ФАЙЛА ---
# Создаем один экземпляр настроек для всего приложения
settings = Settings()
