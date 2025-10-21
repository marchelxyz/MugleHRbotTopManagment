#!/usr/bin/env python3
"""
Скрипт для создания таблицы statix_bonus_items
"""
import asyncio
import asyncpg
import os

async def create_statix_table():
    # Получаем URL базы данных из переменных окружения или используем значение по умолчанию
    database_url = os.getenv('DATABASE_URL', 'postgresql://user:password@localhost/dbname')
    
    # Парсим URL для подключения
    if database_url.startswith('postgresql://'):
        # Заменяем postgresql:// на postgresql+asyncpg:// для asyncpg
        database_url = database_url.replace('postgresql://', 'postgresql+asyncpg://')
    
    # Создаем подключение напрямую через asyncpg
    conn = await asyncpg.connect(database_url.replace('postgresql+asyncpg://', 'postgresql://'))
    
    try:
        # Создаем таблицу statix_bonus_items
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS statix_bonus_items (
                id SERIAL PRIMARY KEY,
                name VARCHAR NOT NULL DEFAULT 'Бонусы Statix',
                description TEXT,
                image_url VARCHAR,
                is_active BOOLEAN NOT NULL DEFAULT true,
                thanks_to_statix_rate INTEGER NOT NULL DEFAULT 10,
                min_bonus_per_step INTEGER NOT NULL DEFAULT 100,
                max_bonus_per_step INTEGER NOT NULL DEFAULT 10000,
                bonus_step INTEGER NOT NULL DEFAULT 100,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        ''')
        
        print("Таблица statix_bonus_items создана успешно!")
        
        # Вставляем запись по умолчанию, если таблица пустая
        result = await conn.fetchval('SELECT COUNT(*) FROM statix_bonus_items')
        if result == 0:
            await conn.execute('''
                INSERT INTO statix_bonus_items (name, description, thanks_to_statix_rate, min_bonus_per_step, max_bonus_per_step, bonus_step)
                VALUES ('Бонусы Statix', 'Покупка бонусов для платформы Statix', 10, 100, 10000, 100);
            ''')
            print("Добавлена запись по умолчанию для Statix Bonus!")
        
    except Exception as e:
        print(f"Ошибка при создании таблицы: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(create_statix_table())