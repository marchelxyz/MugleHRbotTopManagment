#!/usr/bin/env python3
"""
Прямое применение миграции 006_add_browser_auth.sql
Попытка подключения к базе данных с использованием переменных окружения
"""
import asyncio
import os
import sys
from pathlib import Path

# Пытаемся загрузить переменные окружения из различных источников
from dotenv import load_dotenv

# Загружаем из .env файла, если он существует
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    # Пытаемся загрузить из родительской директории
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    else:
        load_dotenv()  # Загружаем из текущей директории

# Проверяем наличие DATABASE_URL
database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("❌ Переменная окружения DATABASE_URL не найдена")
    print("\nПопробуйте установить переменные окружения:")
    print("  export DATABASE_URL='postgresql://user:password@host:port/database'")
    print("  export ADMIN_API_KEY='your-api-key'")
    print("  export TELEGRAM_BOT_TOKEN='your-token'")
    print("  # ... и другие необходимые переменные")
    print("\nИли создайте файл .env в директории backend/ с этими переменными")
    sys.exit(1)

print(f"✅ DATABASE_URL найден: {database_url[:20]}...")

# Теперь импортируем модули
sys.path.append(str(Path(__file__).parent))

try:
    from database import engine
    from sqlalchemy import text
except Exception as e:
    print(f"❌ Ошибка при импорте модулей: {e}")
    sys.exit(1)

async def apply_migration():
    """Применяет миграцию для добавления полей аутентификации через браузер"""
    migration_file = Path(__file__).parent / "migrations" / "006_add_browser_auth.sql"
    
    if not migration_file.exists():
        print(f"❌ Файл миграции не найден: {migration_file}")
        return False
    
    print(f"\n📄 Применение миграции: {migration_file.name}")
    print("   Добавление полей: login, password_hash, browser_auth_enabled")
    
    try:
        with open(migration_file, 'r', encoding='utf-8') as f:
            migration_sql = f.read()
        
        async with engine.begin() as conn:
            # Выполняем миграцию
            await conn.execute(text(migration_sql))
            print("✅ Миграция применена успешно!")
            print("\n📝 Поля login, password_hash и browser_auth_enabled добавлены в таблицу users")
            return True
            
    except Exception as e:
        print(f"❌ Ошибка при применении миграции: {e}")
        print(f"   Тип ошибки: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(apply_migration())
    sys.exit(0 if success else 1)
