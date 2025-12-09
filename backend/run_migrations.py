#!/usr/bin/env python3
"""
Скрипт для запуска миграций базы данных
"""
import asyncio
import os
import sys
from pathlib import Path

# Добавляем текущую директорию в путь для импорта модулей
sys.path.append(str(Path(__file__).parent))

from database import engine
from sqlalchemy import text

async def run_migrations():
    """Запускает все миграции из папки migrations"""
    migrations_dir = Path(__file__).parent / "migrations"
    
    if not migrations_dir.exists():
        print("❌ Папка migrations не найдена")
        return
    
    # Получаем список файлов миграций и сортируем их
    migration_files = sorted([f for f in migrations_dir.glob("*.sql")])
    
    if not migration_files:
        print("❌ Файлы миграций не найдены")
        return
    
    print(f"🔍 Найдено {len(migration_files)} файлов миграций")
    
    async with engine.begin() as conn:
        for migration_file in migration_files:
            print(f"📄 Запуск миграции: {migration_file.name}")
            
            try:
                with open(migration_file, 'r', encoding='utf-8') as f:
                    migration_sql = f.read()
                
                # Выполняем миграцию
                await conn.execute(text(migration_sql))
                print(f"✅ Миграция {migration_file.name} выполнена успешно")
                
            except Exception as e:
                print(f"❌ Ошибка при выполнении миграции {migration_file.name}: {e}")
                # Продолжаем выполнение других миграций
                continue
    
    print("🎉 Все миграции выполнены!")

if __name__ == "__main__":
    asyncio.run(run_migrations())