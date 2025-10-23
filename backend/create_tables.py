#!/usr/bin/env python3
"""
Скрипт для создания таблиц базы данных
"""
import asyncio
import sys
from pathlib import Path

# Добавляем текущую директорию в путь для импорта модулей
sys.path.append(str(Path(__file__).parent))

from database import engine, Base

async def create_tables():
    """Создает все таблицы в базе данных"""
    print("🔧 Создание таблиц в базе данных...")
    
    try:
        async with engine.begin() as conn:
            # Создаем все таблицы
            await conn.run_sync(Base.metadata.create_all)
            print("✅ Все таблицы созданы успешно!")
            
            # Добавляем поле is_shared_gift в таблицу market_items
            try:
                await conn.execute("ALTER TABLE market_items ADD COLUMN IF NOT EXISTS is_shared_gift BOOLEAN DEFAULT FALSE NOT NULL;")
                print("✅ Поле is_shared_gift добавлено в market_items")
            except Exception as e:
                print(f"⚠️ Поле is_shared_gift уже существует или ошибка: {e}")
            
            # Создаем таблицу shared_gift_invitations
            try:
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS shared_gift_invitations (
                        id SERIAL PRIMARY KEY,
                        buyer_id INTEGER NOT NULL REFERENCES users(id),
                        invited_user_id INTEGER NOT NULL REFERENCES users(id),
                        item_id INTEGER NOT NULL REFERENCES market_items(id),
                        status VARCHAR(20) DEFAULT 'pending' NOT NULL,
                        created_at TIMESTAMP DEFAULT NOW(),
                        expires_at TIMESTAMP NOT NULL,
                        accepted_at TIMESTAMP NULL,
                        rejected_at TIMESTAMP NULL
                    );
                """)
                print("✅ Таблица shared_gift_invitations создана")
                
                # Создаем индексы
                await conn.execute("CREATE INDEX IF NOT EXISTS idx_shared_gift_invitations_buyer_id ON shared_gift_invitations(buyer_id);")
                await conn.execute("CREATE INDEX IF NOT EXISTS idx_shared_gift_invitations_invited_user_id ON shared_gift_invitations(invited_user_id);")
                await conn.execute("CREATE INDEX IF NOT EXISTS idx_shared_gift_invitations_item_id ON shared_gift_invitations(item_id);")
                await conn.execute("CREATE INDEX IF NOT EXISTS idx_shared_gift_invitations_status ON shared_gift_invitations(status);")
                await conn.execute("CREATE INDEX IF NOT EXISTS idx_shared_gift_invitations_expires_at ON shared_gift_invitations(expires_at);")
                print("✅ Индексы для shared_gift_invitations созданы")
                
            except Exception as e:
                print(f"⚠️ Таблица shared_gift_invitations уже существует или ошибка: {e}")
            
    except Exception as e:
        print(f"❌ Ошибка при создании таблиц: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = asyncio.run(create_tables())
    if success:
        print("🎉 Все готово!")
    else:
        print("💥 Произошла ошибка!")
        sys.exit(1)