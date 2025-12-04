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
from sqlalchemy import text, select

async def run_migrations():
    """Запускает все миграции из папки migrations"""
    migrations_dir = Path(__file__).parent / "migrations"
    
    if not migrations_dir.exists():
        print(f"❌ Папка migrations не найдена: {migrations_dir}")
        print(f"📂 Текущая директория: {Path(__file__).parent}")
        return
    
    # Создаем таблицу для отслеживания миграций (если её еще нет)
    create_migrations_table_sql = """
    CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_schema_migrations_name ON schema_migrations(migration_name);
    """
    
    try:
        async with engine.begin() as conn:
            await conn.execute(text(create_migrations_table_sql))
            print("✅ Таблица schema_migrations создана/проверена")
    except Exception as e:
        print(f"❌ Ошибка при создании таблицы schema_migrations: {e}")
        raise
    
    # Получаем список уже примененных миграций
    async with engine.connect() as conn:
        result = await conn.execute(select(text("migration_name")).select_from(text("schema_migrations")))
        applied_migrations = {row[0] for row in result.fetchall()}
        print(f"📋 Уже применено миграций: {len(applied_migrations)}")
    
    # Получаем список файлов миграций и сортируем их
    migration_files = sorted([f for f in migrations_dir.glob("*.sql")])
    
    if not migration_files:
        print("⚠️ Файлы миграций не найдены")
        return
    
    print(f"🔍 Найдено {len(migration_files)} файлов миграций")
    
    for migration_file in migration_files:
        migration_name = migration_file.name
        
        # Пропускаем миграции, которые уже были применены
        if migration_name in applied_migrations:
            print(f"⏭️  Миграция {migration_name} уже применена, пропускаем")
            continue
        
        print(f"📄 Запуск миграции: {migration_name}")
        
        try:
            with open(migration_file, 'r', encoding='utf-8') as f:
                migration_sql = f.read()
            
            # Применяем миграцию в транзакции
            async with engine.begin() as conn:
                # Выполняем SQL миграции
                await conn.execute(text(migration_sql))
                
                # Записываем факт применения миграции
                insert_migration = text("INSERT INTO schema_migrations (migration_name) VALUES (:name) ON CONFLICT DO NOTHING")
                await conn.execute(insert_migration, {"name": migration_name})
            
            print(f"✅ Миграция {migration_name} выполнена успешно")
            
        except Exception as e:
            error_msg = f"❌ КРИТИЧЕСКАЯ ОШИБКА при выполнении миграции {migration_name}: {e}"
            print(error_msg)
            import traceback
            traceback.print_exc()
            raise RuntimeError(error_msg) from e
    
    print("🎉 Все миграции выполнены!")

if __name__ == "__main__":
    asyncio.run(run_migrations())