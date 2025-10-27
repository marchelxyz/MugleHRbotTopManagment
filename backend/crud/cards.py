# backend/crud/cards.py

from typing import Optional
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_
import models
import schemas
import pyzipper
import openpyxl
import pandas as pd
from io import BytesIO


async def process_pkpass_file(db: AsyncSession, user_id: int, file_content: bytes):
    """Обработать PKPASS файл"""
    user = await db.get(models.User, user_id)
    if not user:
        return None
    
    try:
        # Распаковываем PKPASS файл
        with pyzipper.AesZipFile(BytesIO(file_content)) as zf:
            # Читаем pass.json
            pass_json = zf.read('pass.json')
            import json
            pass_data = json.loads(pass_json)
            
            # Извлекаем данные
            barcode = pass_data.get('barcode', {}).get('message', '')
            if not barcode:
                return {"success": False, "message": "Не найден штрих-код в файле"}
            
            # Обновляем данные пользователя
            user.card_barcode = barcode
            user.card_balance = 0  # Изначально баланс карты 0
            
            # Синхронизируем имя и фамилию из pass.json если они есть
            if 'userInfo' in pass_data:
                user_info = pass_data['userInfo']
                if 'firstName' in user_info:
                    user.first_name = user_info['firstName']
                if 'lastName' in user_info:
                    user.last_name = user_info['lastName']
            
            await db.commit()
            await db.refresh(user)
            
            return {
                "success": True,
                "barcode": barcode,
                "message": "Карта успешно привязана"
            }
    
    except Exception as e:
        return {"success": False, "message": f"Ошибка обработки файла: {str(e)}"}


async def delete_user_card(db: AsyncSession, user_id: int):
    """Удалить карту пользователя"""
    user = await db.get(models.User, user_id)
    if not user:
        return None
    
    user.card_barcode = None
    user.card_balance = None
    
    await db.commit()
    await db.refresh(user)
    
    return {"success": True, "message": "Карта удалена"}
