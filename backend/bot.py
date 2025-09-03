# backend/bot.py
import httpx
from database import settings
import json # Добавляем импорт json

# URL для отправки сообщений через API Telegram
TELEGRAM_API_URL = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/"

SEND_MESSAGE_URL = f"{TELEGRAM_API_URL}sendMessage"
ANSWER_CALLBACK_URL = f"{TELEGRAM_API_URL}answerCallbackQuery"

# --- ИЗМЕНЕНИЕ: Функция теперь может принимать кнопки и ID темы ---
async def send_telegram_message(chat_id: int, text: str, reply_markup: dict = None, message_thread_id: int = None):
    """
    Асинхронно отправляет сообщение в указанный чат Telegram.
    Может включать inline-кнопки и отправлять в тему.
    """
    payload = {
        'chat_id': chat_id,
        'text': text,
        'parse_mode': 'Markdown'
    }
    if reply_markup:
        payload['reply_markup'] = json.dumps(reply_markup)
    
    if message_thread_id:
        payload['message_thread_id'] = message_thread_id
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(SEND_MESSAGE_URL, json=payload)
            response.raise_for_status()
            print(f"Successfully sent message to chat_id: {chat_id}")
        except httpx.HTTPStatusError as e:
            print(f"Error sending message to {chat_id}: {e.response.json()}")
        except Exception as e:
            print(f"An unexpected error occurred: {e}")

# --- НАЧАЛО ИЗМЕНЕНИЙ: Добавляем новую функцию ---
async def answer_callback_query(callback_query_id: str):
    """Отправляет ответ на нажатие inline-кнопки, чтобы убрать 'часики'."""
    payload = {'callback_query_id': callback_query_id}
    async with httpx.AsyncClient() as client:
        try:
            await client.post(ANSWER_CALLBACK_URL, json=payload)
        except Exception as e:
            print(f"Could not answer callback query. Error: {e}")
# --- КОНЕЦ ИЗМЕНЕНИЙ ---
