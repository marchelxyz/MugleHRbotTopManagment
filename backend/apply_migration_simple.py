#!/usr/bin/env python3
"""
Простой скрипт для применения миграции 006_add_browser_auth.sql
Читает переменные окружения из системы
"""
import asyncio
import os
import sys
from pathlib import Path

# Добавляем текущую директорию в путь для импорта модулей
sys.path.append(str(Path(__file__).parent))

# Загружаем переменные окружения из .env файла, если он существует
from dotenv import load_dotenv
load_dotenv()

try:
    from database import engine
    from sqlalchemy import text
except Exception as e:
    print(f"❌ Ошибка при импорте модулей: {e}")
    print("Проверьте, что все зависимости установлены и переменные окружения настроены")
    sys.exit(1)

async def apply_migration():
    """Применяет миграцию для добавления полей аутентификации через браузер"""
    migration_file = Path(__file__).parent / "migrations" / "006_add_browser_auth.sql"
    
    if not migration_file.exists():
        print(f"❌ Файл миграции не найден: {migration_file}")
        return False
    
    print(f"📄 Применение миграции: {migration_file.name}")
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
