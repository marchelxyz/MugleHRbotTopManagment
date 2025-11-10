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
            result = response.json()
            if result.get('ok'):
                print(f"Successfully sent message to chat_id: {chat_id}")
                return result
            else:
                error_msg = result.get('description', 'Unknown error')
                print(f"Telegram API error sending message to {chat_id}: {error_msg}")
                raise Exception(f"Telegram API error: {error_msg}")
        except httpx.HTTPStatusError as e:
            try:
                error_data = e.response.json()
                error_msg = error_data.get('description', str(e))
            except:
                error_msg = str(e)
            print(f"HTTP error sending message to {chat_id}: {error_msg}")
            raise Exception(f"HTTP error: {error_msg}")
        except Exception as e:
            print(f"An unexpected error occurred while sending message to {chat_id}: {e}")
            raise

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

# --- ФУНКЦИИ ДЛЯ СОВМЕСТНЫХ ПОДАРКОВ ---
async def send_shared_gift_invitation(invited_user_telegram_id: int, buyer_name: str, item_name: str, invitation_id: int):
    """Отправить уведомление о приглашении на совместный подарок"""
    text = (
        f"🎁 *Приглашение на совместный подарок!*\n\n"
        f"👤 *{buyer_name}* приглашает вас разделить товар *{item_name}*\n\n"
        f"💰 Покупатель оплачивает полную стоимость\n"
        f"⏰ Приглашение действует 24 часа"
    )
    
    reply_markup = {
        "inline_keyboard": [
            [
                {
                    "text": "✅ Принять",
                    "callback_data": f"accept_shared_gift_{invitation_id}"
                },
                {
                    "text": "❌ Отказаться", 
                    "callback_data": f"reject_shared_gift_{invitation_id}"
                }
            ]
        ]
    }
    
    await send_telegram_message(invited_user_telegram_id, text, reply_markup)

async def send_shared_gift_accepted_notification(buyer_telegram_id: int, invited_user_name: str, item_name: str):
    """Уведомить покупателя о принятии приглашения"""
    text = (
        f"✅ *Приглашение принято!*\n\n"
        f"👤 *{invited_user_name}* согласился разделить товар *{item_name}*\n\n"
        f"🎁 Товар будет выдан администратором в чате"
    )
    
    await send_telegram_message(buyer_telegram_id, text)

async def send_shared_gift_rejected_notification(buyer_telegram_id: int, invited_user_name: str, item_name: str):
    """Уведомить покупателя об отклонении приглашения"""
    text = (
        f"❌ *Приглашение отклонено*\n\n"
        f"👤 *{invited_user_name}* отклонил приглашение на товар *{item_name}*\n\n"
        f"💰 Вам возвращена полная стоимость товара"
    )
    
    await send_telegram_message(buyer_telegram_id, text)

async def send_shared_gift_expired_notification(buyer_telegram_id: int, item_name: str):
    """Уведомить покупателя об истечении приглашения"""
    text = (
        f"⏰ *Приглашение истекло*\n\n"
        f"Время на принятие приглашения на товар *{item_name}* истекло\n\n"
        f"💰 Вам возвращена полная стоимость товара"
    )
    
    await send_telegram_message(buyer_telegram_id, text)
