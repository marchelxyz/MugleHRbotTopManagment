import httpx
from database import settings
import json
import logging
import re

logger = logging.getLogger(__name__)

TELEGRAM_API_URL = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/"

SEND_MESSAGE_URL = f"{TELEGRAM_API_URL}sendMessage"
ANSWER_CALLBACK_URL = f"{TELEGRAM_API_URL}answerCallbackQuery"

def escape_markdown(text) -> str:
    """
    Экранирует специальные символы Markdown для безопасного использования в сообщениях Telegram.
    Экранирует: _, *, `, [, ], (, ), ~, >, #, +, -, =, |, {, }, ., !
    Принимает строку, None или другие типы (преобразует в строку).
    """
    if text is None:
        return ''
    if not isinstance(text, str):
        text = str(text)
    if not text:
        return text
    special_chars = ['_', '*', '`', '[', ']', '(', ')', '~', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!']
    for char in special_chars:
        text = text.replace(char, f'\\{char}')
    return text

def escape_html(text) -> str:
    """
    Экранирует специальные символы HTML для безопасного использования в сообщениях Telegram.
    Экранирует только: <, >, &
    Принимает строку, None или другие типы (преобразует в строку).
    """
    if text is None:
        return ''
    if not isinstance(text, str):
        text = str(text)
    if not text:
        return text
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    return text

async def send_telegram_message(chat_id: int, text: str, reply_markup: dict = None, message_thread_id: int = None, parse_mode: str = 'HTML'):
    """
    Асинхронно отправляет сообщение в указанный чат Telegram.
    Может включать inline-кнопки и отправлять в тему.
    parse_mode: 'Markdown', 'HTML' или None для отправки без форматирования.
    По умолчанию используется HTML для избежания проблем с символами в именах пользователей.
    """
    payload = {
        'chat_id': chat_id,
        'text': text
    }
    if parse_mode:
        payload['parse_mode'] = parse_mode
    if reply_markup:
        payload['reply_markup'] = json.dumps(reply_markup)
    
    if message_thread_id:
        payload['message_thread_id'] = message_thread_id
    
    timeout = httpx.Timeout(30.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
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

async def answer_callback_query(
    callback_query_id: str,
    text: str | None = None,
    show_alert: bool = False,
) -> bool:
    """Отвечает на inline-кнопку (снимает «часики»). Обязательно проверять ответ API.

    Раньше игнорировался ``ok: false`` от Telegram — клиент видел бесконечную загрузку.
    """
    payload: dict = {"callback_query_id": callback_query_id}
    if text:
        payload["text"] = text[:200]
    if show_alert:
        payload["show_alert"] = True
    timeout = httpx.Timeout(30.0, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.post(ANSWER_CALLBACK_URL, json=payload)
            response.raise_for_status()
            result = response.json()
            if result.get("ok"):
                return True
            logger.error(
                "answerCallbackQuery отклонён Telegram: %s (id=%s…)",
                result.get("description", result),
                callback_query_id[:12],
            )
            return False
        except httpx.HTTPStatusError as e:
            try:
                body = e.response.json()
                desc = body.get("description", e.response.text)
            except Exception:
                desc = e.response.text
            logger.error(
                "answerCallbackQuery HTTP %s: %s",
                e.response.status_code,
                desc,
            )
            return False
        except Exception as e:
            logger.exception("answerCallbackQuery: %s", e)
            return False

async def send_shared_gift_invitation(invited_user_telegram_id: int, buyer_name: str, item_name: str, invitation_id: int):
    """Отправить уведомление о приглашении на совместный подарок"""
    text = (
        f"🎁 <b>Приглашение на совместный подарок!</b>\n\n"
        f"👤 <b>{escape_html(buyer_name)}</b> приглашает вас разделить товар <b>{escape_html(item_name)}</b>\n\n"
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
        f"✅ <b>Приглашение принято!</b>\n\n"
        f"👤 <b>{escape_html(invited_user_name)}</b> согласился разделить товар <b>{escape_html(item_name)}</b>\n\n"
        f"🎁 Товар будет выдан администратором в чате"
    )
    
    await send_telegram_message(buyer_telegram_id, text)

async def send_shared_gift_rejected_notification(buyer_telegram_id: int, invited_user_name: str, item_name: str):
    """Уведомить покупателя об отклонении приглашения"""
    text = (
        f"❌ <b>Приглашение отклонено</b>\n\n"
        f"👤 <b>{escape_html(invited_user_name)}</b> отклонил приглашение на товар <b>{escape_html(item_name)}</b>\n\n"
        f"💰 Вам возвращена полная стоимость товара"
    )
    
    await send_telegram_message(buyer_telegram_id, text)

async def send_shared_gift_expired_notification(buyer_telegram_id: int, item_name: str):
    """Уведомить покупателя об истечении приглашения"""
    text = (
        f"⏰ <b>Приглашение истекло</b>\n\n"
        f"Время на принятие приглашения на товар <b>{escape_html(item_name)}</b> истекло\n\n"
        f"💰 Вам возвращена полная стоимость товара"
    )
    
    await send_telegram_message(buyer_telegram_id, text)
