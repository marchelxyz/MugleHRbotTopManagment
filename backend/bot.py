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

# Классификация постоянных ошибок Telegram (повторная попытка не имеет смысла).
# Возвращаются в ответе как description, см. https://core.telegram.org/bots/api
_TG_PERMANENT_ERROR_PATTERNS = (
    "forbidden: bot was blocked by the user",
    "forbidden: user is deactivated",
    "forbidden: bot can't initiate conversation",
    "chat not found",
    "user not found",
    "peer_id_invalid",
)
_TG_TOPIC_ERROR_PATTERNS = (
    "message thread not found",
    "topic_closed",
    "topic_deleted",
)


def classify_telegram_error(description: str) -> str:
    """Возвращает короткий код ошибки Telegram: blocked / not_found / topic / parse / other."""
    if not description:
        return "other"
    desc = description.lower()
    if "blocked by the user" in desc:
        return "blocked"
    if "user is deactivated" in desc:
        return "deactivated"
    if "chat not found" in desc or "peer_id_invalid" in desc:
        return "not_found"
    if "bot can't initiate conversation" in desc:
        return "no_dialog"
    if any(p in desc for p in _TG_TOPIC_ERROR_PATTERNS):
        return "topic"
    if "can't parse entities" in desc or "bad request: can't parse" in desc:
        return "parse"
    if "too many requests" in desc:
        return "rate_limit"
    if "timed out" in desc or "timeout" in desc:
        return "timeout"
    if "network" in desc or "name or service not known" in desc or "connection" in desc:
        return "network"
    return "other"


def is_permanent_telegram_error(description: str) -> bool:
    """Постоянная ошибка: пользователь недоступен/заблокировал бота, чат не найден."""
    if not description:
        return False
    desc = description.lower()
    return any(p in desc for p in _TG_PERMANENT_ERROR_PATTERNS)


# Человекочитаемые причины недоставки — единый источник правды для UI и Excel.
# Ключи синхронизированы с classify_telegram_error и кодами рассылки в crud.py.
DELIVERY_REASON_LABELS: dict[str, str] = {
    # Telegram
    "blocked": "Пользователь заблокировал бота",
    "deactivated": "Аккаунт Telegram удалён или заморожен",
    "not_found": "Чат с пользователем не найден (некорректный telegram_id)",
    "no_dialog": "Бот не может первым написать пользователю",
    "no_bot_dialog": "Пользователь ни разу не нажимал /start у бота",
    "topic": "Тема (топик) в админ-чате удалена или закрыта",
    "parse": "Ошибка форматирования сообщения (HTML/Markdown)",
    "rate_limit": "Telegram временно ограничил частоту отправки",
    "timeout": "Таймаут соединения с серверами Telegram",
    "network": "Сетевая ошибка при обращении к Telegram",
    # Email
    "smtp_error": "SMTP отверг письмо (проверьте логин/пароль и хост)",
    "smtp_auth": "Ошибка аутентификации SMTP (логин/пароль)",
    "smtp_connect": "Не удалось подключиться к SMTP-серверу",
    "smtp_recipient": "Адресат отверг письмо (несуществующий ящик)",
    "invalid_email": "Невалидный email-адрес в профиле",
    # Общие
    "exception": "Внутренний сбой при отправке",
    "other": "Не удалось доставить (см. detail)",
}


def human_delivery_reason(code: str | None) -> str:
    """Возвращает русское объяснение кода ошибки доставки.

    Если код не известен — возвращает «Не удалось доставить».
    """
    if not code:
        return "—"
    return DELIVERY_REASON_LABELS.get(code, DELIVERY_REASON_LABELS["other"])


def classify_smtp_error(description: str | None) -> str:
    """Возвращает код SMTP-ошибки по тексту исключения.

    Используется только при exception на send_email — типовые ошибки SMTP мы
    хотим маркировать осмысленно, чтобы в Excel-отчёте читатель сразу видел
    причину (а не сухой stacktrace).
    """
    if not description:
        return "smtp_error"
    desc = description.lower()
    if "535" in desc or "incorrect authentication" in desc or "authentication" in desc:
        return "smtp_auth"
    if (
        "connect" in desc
        or "name or service not known" in desc
        or "nxdomain" in desc
        or "timed out connecting" in desc
    ):
        return "smtp_connect"
    if "550" in desc or "554" in desc or "no such user" in desc or "user unknown" in desc:
        return "smtp_recipient"
    return "smtp_error"


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
                logger.info("Telegram sendMessage ok chat_id=%s thread=%s", chat_id, message_thread_id)
                return result
            else:
                error_msg = result.get('description', 'Unknown error')
                logger.error(
                    "Telegram API error sending to %s (thread=%s): %s",
                    chat_id, message_thread_id, error_msg,
                )
                raise Exception(f"Telegram API error: {error_msg}")
        except httpx.HTTPStatusError as e:
            try:
                error_data = e.response.json()
                error_msg = error_data.get('description', str(e))
            except Exception:
                error_msg = str(e)
            logger.error(
                "HTTP error sending to %s (thread=%s): %s",
                chat_id, message_thread_id, error_msg,
            )
            raise Exception(f"HTTP error: {error_msg}")
        except Exception as e:
            logger.error(
                "Unexpected error sending to %s (thread=%s): %s",
                chat_id, message_thread_id, e,
            )
            raise


async def safe_admin_notify(
    chat_id: int,
    text: str,
    reply_markup: dict | None = None,
    message_thread_id: int | None = None,
    parse_mode: str | None = "HTML",
) -> dict:
    """Отправка уведомления в админ-чат с фолбэками и без проброса исключений.

    Делает 3 попытки:
      1. Как заказано (тред + parse_mode);
      2. Без message_thread_id (если тред «protected»/удалён или Telegram отвечает thread not found);
      3. Без parse_mode (на случай ошибок парсинга HTML/Markdown).

    Возвращает: ``{"ok": bool, "attempt": int, "error": str|None, "fallback": str|None}``.
    Никогда не бросает исключений — для устойчивости основной бизнес-логики.
    """
    attempts: list[dict] = []
    fallback_used: str | None = None

    async def _try(thread, mode):
        try:
            await send_telegram_message(
                chat_id=chat_id,
                text=text,
                reply_markup=reply_markup,
                message_thread_id=thread,
                parse_mode=mode,
            )
            return None
        except Exception as exc:
            return str(exc)

    err1 = await _try(message_thread_id, parse_mode)
    if err1 is None:
        return {"ok": True, "attempt": 1, "error": None, "fallback": None}
    attempts.append({"attempt": 1, "error": err1})

    err1_low = err1.lower()
    if message_thread_id and (
        "thread not found" in err1_low
        or "topic_closed" in err1_low
        or "topic_deleted" in err1_low
    ):
        err2 = await _try(None, parse_mode)
        if err2 is None:
            fallback_used = "no_thread"
            logger.warning(
                "safe_admin_notify: тред %s недоступен в чате %s, отправлено без треда",
                message_thread_id, chat_id,
            )
            return {"ok": True, "attempt": 2, "error": None, "fallback": fallback_used}
        attempts.append({"attempt": 2, "error": err2})
        err1_low = err2.lower()

    if parse_mode and ("can't parse" in err1_low or "parse entities" in err1_low):
        err3 = await _try(message_thread_id, None)
        if err3 is None:
            fallback_used = "no_parse_mode"
            logger.warning(
                "safe_admin_notify: HTML парсер отверг сообщение в %s, отправлено plain",
                chat_id,
            )
            return {"ok": True, "attempt": 3, "error": None, "fallback": fallback_used}
        attempts.append({"attempt": 3, "error": err3})

    logger.error(
        "safe_admin_notify: все попытки провалены chat=%s thread=%s attempts=%s",
        chat_id, message_thread_id, attempts,
    )
    return {
        "ok": False,
        "attempt": len(attempts),
        "error": attempts[-1]["error"] if attempts else "unknown",
        "fallback": fallback_used,
    }

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
