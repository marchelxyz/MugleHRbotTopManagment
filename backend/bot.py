# backend/bot.py

import httpx
from database import settings

# URL для отправки сообщений через API Telegram
TELEGRAM_API_URL = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"

async def send_telegram_message(chat_id: int, text: str):
    """
    Асинхронно отправляет сообщение в указанный чат Telegram.
    """
    payload = {
        'chat_id': chat_id,
        'text': text,
        'parse_mode': 'Markdown' # Используем Markdown для форматирования
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(TELEGRAM_API_URL, json=payload)
            response.raise_for_status()  # Вызовет ошибку, если запрос был неуспешным
            print(f"Successfully sent message to chat_id: {chat_id}")
        except httpx.HTTPStatusError as e:
            print(f"Error sending message to {chat_id}: {e.response.json()}")
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
