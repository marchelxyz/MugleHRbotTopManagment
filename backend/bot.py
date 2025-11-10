# backend/bot.py
import httpx
from database import settings
import json # Добавляем импорт json
import asyncio
import logging

# Настройка логирования
logger = logging.getLogger(__name__)

# URL для отправки сообщений через API Telegram
TELEGRAM_API_URL = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/"

SEND_MESSAGE_URL = f"{TELEGRAM_API_URL}sendMessage"
ANSWER_CALLBACK_URL = f"{TELEGRAM_API_URL}answerCallbackQuery"

# Ошибки Telegram API, которые не требуют retry
NON_RETRYABLE_ERRORS = [
    "chat not found",
    "user is deactivated",
    "bot was blocked by the user",
    "message is too long",
    "message can't be deleted",
    "bad request",
    "message to delete not found",
    "message to edit not found",
    "can't parse entities",
]

# --- ИЗМЕНЕНИЕ: Функция теперь может принимать кнопки и ID темы с retry логикой ---
async def send_telegram_message(chat_id: int, text: str, reply_markup: dict = None, message_thread_id: int = None, max_retries: int = 3):
    """
    Асинхронно отправляет сообщение в указанный чат Telegram с retry логикой.
    Может включать inline-кнопки и отправлять в тему.
    
    Args:
        chat_id: ID чата для отправки сообщения
        text: Текст сообщения
        reply_markup: Опциональные inline-кнопки
        message_thread_id: Опциональный ID темы в группе
        max_retries: Максимальное количество попыток отправки (по умолчанию 3)
    
    Returns:
        dict: Результат отправки от Telegram API
    
    Raises:
        Exception: Если сообщение не удалось отправить после всех попыток
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
    
    # Таймауты для HTTP запросов
    timeout = httpx.Timeout(30.0, connect=10.0)
    
    last_error = None
    
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(SEND_MESSAGE_URL, json=payload)
                response.raise_for_status()
                result = response.json()
                
                if result.get('ok'):
                    logger.info(f"Successfully sent message to chat_id: {chat_id}")
                    return result
                else:
                    error_code = result.get('error_code')
                    error_msg = result.get('description', 'Unknown error').lower()
                    
                    # Проверяем, является ли ошибка критической (не требует retry)
                    if any(non_retryable in error_msg for non_retryable in NON_RETRYABLE_ERRORS):
                        logger.warning(f"Non-retryable Telegram API error sending message to {chat_id}: {error_msg} (code: {error_code})")
                        raise Exception(f"Telegram API error: {error_msg} (code: {error_code})")
                    
                    # Обработка rate limiting (429 Too Many Requests)
                    if error_code == 429:
                        retry_after = result.get('parameters', {}).get('retry_after', 60)
                        if attempt < max_retries - 1:
                            logger.warning(f"Rate limit hit for chat_id {chat_id}. Waiting {retry_after} seconds before retry {attempt + 1}/{max_retries}")
                            await asyncio.sleep(retry_after)
                            continue
                        else:
                            raise Exception(f"Rate limit exceeded after {max_retries} attempts")
                    
                    # Для других ошибок пробуем повторить
                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt  # Экспоненциальная задержка: 1s, 2s, 4s
                        logger.warning(f"Telegram API error sending message to {chat_id} (attempt {attempt + 1}/{max_retries}): {error_msg}. Retrying in {wait_time}s...")
                        await asyncio.sleep(wait_time)
                        last_error = f"Telegram API error: {error_msg} (code: {error_code})"
                        continue
                    else:
                        raise Exception(f"Telegram API error after {max_retries} attempts: {error_msg} (code: {error_code})")
                        
        except httpx.TimeoutException as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                logger.warning(f"Timeout sending message to {chat_id} (attempt {attempt + 1}/{max_retries}). Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
                last_error = f"Timeout error: {str(e)}"
                continue
            else:
                logger.error(f"Timeout sending message to {chat_id} after {max_retries} attempts: {e}")
                raise Exception(f"Timeout error after {max_retries} attempts: {str(e)}")
                
        except httpx.HTTPStatusError as e:
            # Обработка HTTP ошибок (5xx - временные, 4xx - постоянные)
            if e.response.status_code >= 500 and attempt < max_retries - 1:
                wait_time = 2 ** attempt
                logger.warning(f"HTTP {e.response.status_code} error sending message to {chat_id} (attempt {attempt + 1}/{max_retries}). Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
                last_error = f"HTTP {e.response.status_code} error: {str(e)}"
                continue
            else:
                try:
                    error_data = e.response.json()
                    error_msg = error_data.get('description', str(e))
                except:
                    error_msg = str(e)
                logger.error(f"HTTP error sending message to {chat_id}: {error_msg}")
                raise Exception(f"HTTP error: {error_msg}")
                
        except httpx.NetworkError as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                logger.warning(f"Network error sending message to {chat_id} (attempt {attempt + 1}/{max_retries}). Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
                last_error = f"Network error: {str(e)}"
                continue
            else:
                logger.error(f"Network error sending message to {chat_id} after {max_retries} attempts: {e}")
                raise Exception(f"Network error after {max_retries} attempts: {str(e)}")
                
        except Exception as e:
            # Для других исключений проверяем, нужно ли повторять
            error_str = str(e).lower()
            if any(non_retryable in error_str for non_retryable in NON_RETRYABLE_ERRORS):
                logger.error(f"Non-retryable error sending message to {chat_id}: {e}")
                raise
            
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                logger.warning(f"Unexpected error sending message to {chat_id} (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
                last_error = str(e)
                continue
            else:
                logger.error(f"Unexpected error sending message to {chat_id} after {max_retries} attempts: {e}")
                raise
    
    # Если дошли сюда, значит все попытки исчерпаны
    if last_error:
        raise Exception(f"Failed to send message after {max_retries} attempts. Last error: {last_error}")
    else:
        raise Exception(f"Failed to send message after {max_retries} attempts")

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
