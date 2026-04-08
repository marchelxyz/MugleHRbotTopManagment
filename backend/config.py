from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    # Лог SQL в stdout (dev); в проде оставьте false — меньше шума и нагрузки на логи
    SQLALCHEMY_ECHO: bool = False

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

    # Настройки Redis (REDIS_ENABLED=false — не подключаться и не использовать кеш)
    REDIS_ENABLED: bool = True
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = ""
    REDIS_URL: str = ""

    # Настройки SMTP для отправки email через Timeweb
    SMTP_HOST: str = "smtp.timeweb.ru"  # Исправлено: правильный хост smtp.timeweb.ru
    SMTP_PORT: int = 465  # 465 для SSL, 587 для TLS
    SMTP_USERNAME: str = ""  # Полный email адрес от Timeweb
    SMTP_PASSWORD: str = ""  # Пароль от почтового ящика
    SMTP_USE_TLS: bool = False  # True для порта 587, False для порта 465
    ADMIN_EMAILS: str = ""  # Список email админов через запятую для уведомлений
    WEB_APP_LOGIN_URL: str = ""  # URL страницы входа в веб-приложение (опционально)

    # Object Storage S3 (Timeweb Cloud по умолчанию; совместимо с любым S3 API)
    S3_ENDPOINT_URL: str = "https://s3.twcstorage.ru"
    S3_REGION: str = "ru-1"
    S3_BUCKET: str = ""
    S3_ACCESS_KEY_ID: str = ""
    S3_SECRET_ACCESS_KEY: str = ""
    # Публичный базовый URL (CDN или вирт. хост), без завершающего /. Если пусто — https://storage.../bucket/key
    S3_PUBLIC_BASE_URL: str = ""
    # Для публичного чтения объектов из приложения (если политика бакета использует ACL)
    S3_OBJECT_ACL: str = ""
    IMAGE_AVIF_QUALITY: int = 55
    IMAGE_MAX_SIDE_PX: int = 2048

    # Раздача собранного Vite-фронта из одного контейнера (Docker / Timeweb)
    SERVE_SPA: bool = False
    STATIC_ROOT: str = ""
    # Дополнительные origins для CORS (через запятую), кроме встроенного списка в app.py
    CORS_ORIGINS: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
