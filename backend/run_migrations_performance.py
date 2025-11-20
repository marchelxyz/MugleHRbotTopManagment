#!/usr/bin/env python3
"""
Скрипт для применения миграции производительности (006_add_performance_indexes.sql)
Выполните этот скрипт для добавления индексов в базу данных.
"""

import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from config import Settings

async def run_migration():
    """Применяет миграцию для добавления индексов производительности"""
    settings = Settings()
    database_url = settings.DATABASE_URL
    
    if database_url and database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    engine = create_async_engine(database_url, echo=True)
    
    # Читаем SQL из файла миграции
    migration_file = os.path.join(os.path.dirname(__file__), "migrations", "006_add_performance_indexes.sql")
    
    if not os.path.exists(migration_file):
        print(f"❌ Файл миграции не найден: {migration_file}")
        return
    
    with open(migration_file, "r", encoding="utf-8") as f:
        sql_content = f.read()
    
    try:
        async with engine.begin() as conn:
            # Разделяем SQL на отдельные команды
            # Удаляем комментарии и пустые строки
            commands = [
                cmd.strip() 
                for cmd in sql_content.split(";") 
                if cmd.strip() and not cmd.strip().startswith("--")
            ]
            
            for i, command in enumerate(commands, 1):
                if command:
                    print(f"Выполнение команды {i}/{len(commands)}...")
                    await conn.execute(text(command))
            
            print("✅ Миграция успешно применена!")
            print("📊 Индексы для оптимизации производительности добавлены в базу данных.")
            
    except Exception as e:
        print(f"❌ Ошибка при применении миграции: {e}")
        raise
    finally:
        await engine.dispose()

if __name__ == "__main__":
    print("🚀 Применение миграции производительности...")
    asyncio.run(run_migration())
