# backend/crud/banners.py

from typing import List, Optional
from datetime import datetime, date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_
import models
import schemas
from config import settings
from bot import send_telegram_message
import io
import base64
from PIL import Image, ImageDraw, ImageFont
import textwrap


async def generate_monthly_leaderboard_banners(db: AsyncSession):
    """Генерировать баннеры таблицы лидеров за месяц"""
    # Получаем данные лидеров за текущий месяц
    today = date.today()
    start_date = today.replace(day=1)
    
    # Лидеры по полученным спасибкам
    received_leaders = await db.execute(
        select(
            models.User.first_name,
            models.User.last_name,
            func.sum(models.Transaction.amount).label('total_received')
        )
        .select_from(
            models.Transaction.join(
                models.User, 
                models.Transaction.receiver_id == models.User.id
            )
        )
        .where(
            and_(
                func.date(models.Transaction.timestamp) >= start_date,
                func.date(models.Transaction.timestamp) <= today
            )
        )
        .group_by(models.User.id, models.User.first_name, models.User.last_name)
        .order_by(desc('total_received'))
        .limit(3)
    )
    received_leaders = received_leaders.all()
    
    # Лидеры по отправленным спасибкам
    sent_leaders = await db.execute(
        select(
            models.User.first_name,
            models.User.last_name,
            func.sum(models.Transaction.amount).label('total_sent')
        )
        .select_from(
            models.Transaction.join(
                models.User, 
                models.Transaction.sender_id == models.User.id
            )
        )
        .where(
            and_(
                func.date(models.Transaction.timestamp) >= start_date,
                func.date(models.Transaction.timestamp) <= today
            )
        )
        .group_by(models.User.id, models.User.first_name, models.User.last_name)
        .order_by(desc('total_sent'))
        .limit(3)
    )
    sent_leaders = sent_leaders.all()
    
    # Генерируем баннеры
    banners = []
    
    # Баннер для полученных спасибок
    if received_leaders:
        banner_data = generate_leaderboard_banner(
            "Лидеры по полученным спасибкам",
            received_leaders,
            "received"
        )
        banners.append(banner_data)
    
    # Баннер для отправленных спасибок
    if sent_leaders:
        banner_data = generate_leaderboard_banner(
            "Лидеры по отправленным спасибкам",
            sent_leaders,
            "sent"
        )
        banners.append(banner_data)
    
    return banners


async def generate_current_month_test_banners(db: AsyncSession):
    """Генерировать тестовые баннеры для текущего месяца"""
    # Генерируем тестовые данные
    test_data = [
        ("Иван", "Иванов", 150),
        ("Петр", "Петров", 120),
        ("Сидор", "Сидоров", 100)
    ]
    
    banner_data = generate_leaderboard_banner(
        "Тестовый баннер лидеров",
        test_data,
        "test"
    )
    
    return [banner_data]


def generate_leaderboard_banner(title: str, leaders: List, leader_type: str) -> dict:
    """Генерировать баннер таблицы лидеров"""
    # Создаем изображение
    width, height = 800, 600
    image = Image.new('RGB', (width, height), color='white')
    draw = ImageDraw.Draw(image)
    
    try:
        # Загружаем шрифт (если доступен)
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
        font_medium = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
    except:
        # Fallback на стандартный шрифт
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    # Заголовок
    title_bbox = draw.textbbox((0, 0), title, font=font_large)
    title_width = title_bbox[2] - title_bbox[0]
    title_x = (width - title_width) // 2
    draw.text((title_x, 50), title, fill='black', font=font_large)
    
    # Лидеры
    y_offset = 150
    for i, leader in enumerate(leaders[:3]):
        name = f"{leader[0]} {leader[1]}"
        amount = leader[2]
        
        # Место
        place_text = f"{i + 1}."
        draw.text((100, y_offset), place_text, fill='black', font=font_medium)
        
        # Имя
        draw.text((150, y_offset), name, fill='black', font=font_medium)
        
        # Сумма
        amount_text = f"{amount} спасибок"
        amount_bbox = draw.textbbox((0, 0), amount_text, font=font_medium)
        amount_width = amount_bbox[2] - amount_bbox[0]
        amount_x = width - amount_width - 100
        draw.text((amount_x, y_offset), amount_text, fill='black', font=font_medium)
        
        y_offset += 80
    
    # Сохраняем в base64
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    image_data = buffer.getvalue()
    image_base64 = base64.b64encode(image_data).decode('utf-8')
    
    return {
        "title": title,
        "type": leader_type,
        "image_data": image_base64,
        "created_at": datetime.now().isoformat()
    }
