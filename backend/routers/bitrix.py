"""Эндпоинты Bitrix24: установка приложения, вход (OAuth → user id), события чат-бота."""

from __future__ import annotations

import html
import json
import logging
from typing import Any, Optional
from urllib.parse import parse_qs

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

import bitrix_crud
import schemas
from bitrix_service import (
    bitrix_imbot_message_add,
    normalize_bitrix_domain,
    parse_install_auth_param,
)
from config import settings
from database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/bitrix", tags=["bitrix"])


@router.api_route("/install", methods=["GET", "POST"], response_model=None)
async def bitrix_install(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """
    Первоначальная установка локального приложения: сохраняет токены портала и завершает установку в UI.
    В карточке приложения Bitrix24 укажите этот URL как «Путь для первоначальной установки».

    Если запрос без auth (часто из-за перепутанного «Пути обработчика»), редирект на bitrix.html на Vercel,
    чтобы в iframe открылось приложение, а не пустая справка.
    """
    auth_raw = await _read_install_auth_param(request)
    if not auth_raw:
        return _redirect_to_bitrix_web_app(request)

    try:
        auth = parse_install_auth_param(auth_raw)
    except ValueError as exc:
        return _html_response(_install_parse_error_html(str(exc)))
    if auth is None:
        return _html_response(_install_parse_error_html("Пустой auth"))

    try:
        await bitrix_crud.upsert_bitrix_portal(db, auth)
    except ValueError as exc:
        return _html_response(_install_parse_error_html(str(exc)))

    return _html_response(_install_finish_html())


@router.post("/session", response_model=schemas.BitrixSessionResponse)
async def bitrix_session(
    body: schemas.BitrixSessionRequest,
    db: AsyncSession = Depends(get_db),
) -> schemas.BitrixSessionResponse:
    """
    Обменивает пользовательский OAuth Bitrix24 (из BX24.getAuth) на пользователя HR.
    Вызывается с фронтенда (страница bitrix.html) после BX24.init.
    """
    try:
        user = await bitrix_crud.get_or_create_user_for_bitrix(
            db,
            body.domain,
            body.access_token,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if user.status == "blocked":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Аккаунт заблокирован")
    if user.status == "rejected":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Заявка отклонена")

    return schemas.BitrixSessionResponse(
        user_id=user.id,
        user=schemas.UserResponse.model_validate(user),
    )


@router.post("/event")
async def bitrix_event(request: Request, db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """
    Обработчик событий Bitrix24 (в т.ч. ONIMBOTMESSAGEADD для чат-бота).
    Укажите URL: .../bitrix/event в настройках исходящих вебхуков или при регистрации бота.
    """
    payload = await _parse_event_payload(request)
    event_name = str(payload.get("event") or payload.get("EVENT") or "").strip()
    auth = _parse_auth_from_event_payload(payload)
    await _verify_event_application_token(db, auth)

    raw_data = payload.get("data")
    data_obj: dict[str, Any] = {}
    if isinstance(raw_data, str):
        try:
            data_obj = json.loads(raw_data)
        except json.JSONDecodeError:
            data_obj = {}
    elif isinstance(raw_data, dict):
        data_obj = raw_data

    if event_name == "ONIMBOTMESSAGEADD":
        await _handle_imbot_message_add(db, data_obj, auth)
    else:
        logger.info("Bitrix event (не обработан): %s", event_name)

    return {"status": "ok"}


async def _read_install_auth_param(request: Request) -> Optional[str]:
    """Читает auth из query, JSON-тела или form-data."""
    q = request.query_params.get("auth")
    if q:
        return q
    if request.method != "POST":
        return None
    body = await request.body()
    if not body:
        return None
    try:
        data = json.loads(body.decode("utf-8"))
        if isinstance(data, dict) and data.get("auth") is not None:
            return str(data["auth"])
    except (json.JSONDecodeError, UnicodeDecodeError):
        pass
    try:
        parsed = parse_qs(body.decode("utf-8"))
        if parsed.get("auth"):
            return str(parsed["auth"][0])
    except UnicodeDecodeError:
        pass
    return None


def _html_response(body: str) -> HTMLResponse:
    """Ответ HTML для страниц установки Bitrix (в т.ч. в iframe)."""
    return HTMLResponse(content=body, media_type="text/html; charset=utf-8")


def _redirect_to_bitrix_web_app(request: Request) -> RedirectResponse:
    """
    Редирект на страницу входа Bitrix на Vercel, если /bitrix/install вызван без auth.

    Сохраняет query-string (например DOMAIN от портала), чтобы фронт мог его обработать.
    """
    base = settings.BITRIX_WEB_APP_URL.rstrip("/") + "/bitrix.html"
    q = request.url.query
    target = f"{base}?{q}" if q else base
    logger.info("bitrix/install без параметра auth — редирект 302 на %s", target)
    return RedirectResponse(url=target, status_code=302)


def _install_parse_error_html(detail: str) -> str:
    """HTML при ошибке разбора auth или сохранения портала."""
    safe = html.escape(detail, quote=True)
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <title>Ошибка установки Bitrix24</title>
</head>
<body>
  <h1>Ошибка установки</h1>
  <p>{safe}</p>
</body>
</html>
"""


def _install_finish_html() -> str:
    """HTML с вызовом BX24.installFinish() после успешного сохранения токенов."""
    return """<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <title>Установка HR Спасибо</title>
</head>
<body>
<script src="https://api.bitrix24.com/api/v1/"></script>
<script>
BX24.init(function(){
  BX24.installFinish();
});
</script>
</body>
</html>
"""


async def _parse_event_payload(request: Request) -> dict[str, Any]:
    """Разбирает тело вебхука Bitrix (JSON или x-www-form-urlencoded)."""
    ctype = request.headers.get("content-type", "")
    if "application/json" in ctype:
        body = await request.json()
        return body if isinstance(body, dict) else {}
    form = await request.form()
    return {str(k): v for k, v in form.items()}


def _parse_auth_from_event_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Извлекает блок auth из события Bitrix24."""
    auth = payload.get("auth")
    if isinstance(auth, str):
        try:
            parsed = json.loads(auth)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    if isinstance(auth, dict):
        return auth
    return {}


async def _verify_event_application_token(db: AsyncSession, auth: dict[str, Any]) -> None:
    """Проверяет application_token для исходящих событий (если токен сохранён при установке)."""
    domain = auth.get("domain")
    token = auth.get("application_token")
    if not domain or not token:
        return
    portal = await bitrix_crud.get_bitrix_portal_by_domain(db, str(domain))
    if portal is None or not portal.application_token:
        return
    if str(portal.application_token) != str(token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Неверный application_token события",
        )


async def _handle_imbot_message_add(
    db: AsyncSession,
    data: dict[str, Any],
    auth: dict[str, Any],
) -> None:
    """Отвечает на сообщение чат-боту простыми командами (баланс, помощь)."""
    text, bot_id, dialog_id, from_user_id = _extract_imbot_fields(data)
    access_token = auth.get("access_token")
    domain = auth.get("domain")
    if not text or bot_id is None or not dialog_id or not access_token or not domain:
        logger.warning("ONIMBOTMESSAGEADD: неполные данные для ответа")
        return

    reply = await _compose_bot_reply(db, str(domain), from_user_id, text)
    try:
        await bitrix_imbot_message_add(
            normalize_bitrix_domain(str(domain)),
            str(access_token),
            bot_id,
            dialog_id,
            reply,
        )
    except Exception as exc:
        logger.exception("Не удалось отправить ответ бота: %s", exc)


def _extract_imbot_fields(
    data: dict[str, Any],
) -> tuple[str, Optional[int], Optional[str], Optional[int]]:
    """Достаёт текст, BOT_ID, DIALOG_ID и FROM_USER_ID из payload события."""
    params = data.get("PARAMS") if isinstance(data.get("PARAMS"), dict) else data

    msg = data.get("MESSAGE")
    if msg is None and isinstance(params, dict):
        msg = params.get("MESSAGE")

    text: str = ""
    if isinstance(msg, dict):
        raw = msg.get("TEXT") or msg.get("text") or ""
        text = str(raw).strip()
    elif isinstance(msg, str):
        text = msg.strip()

    bot_raw = data.get("BOT_ID")
    if bot_raw is None and isinstance(params, dict):
        bot_raw = params.get("BOT_ID")
    bot_id: Optional[int] = None
    if bot_raw is not None:
        try:
            bot_id = int(bot_raw)
        except (TypeError, ValueError):
            bot_id = None

    dialog_raw = data.get("DIALOG_ID")
    if dialog_raw is None and isinstance(params, dict):
        dialog_raw = params.get("DIALOG_ID")
    dialog_id = str(dialog_raw).strip() if dialog_raw else None

    from_raw = None
    if isinstance(params, dict):
        from_raw = params.get("FROM_USER_ID") or params.get("MESSAGE_FROM_USER_ID")
    if from_raw is None:
        from_raw = data.get("FROM_USER_ID")

    from_uid: Optional[int] = None
    if from_raw is not None:
        try:
            from_uid = int(from_raw)
        except (TypeError, ValueError):
            from_uid = None

    return text, bot_id, dialog_id, from_uid


async def _compose_bot_reply(
    db: AsyncSession,
    domain: str,
    bitrix_user_id: Optional[int],
    text: str,
) -> str:
    """Формирует текст ответа бота в мессенджере."""
    t = (text or "").strip().lower()
    if bitrix_user_id is None:
        return (
            "Откройте приложение «HR Спасибо» из меню портала Bitrix24 и выполните вход."
        )

    user = await bitrix_crud.find_user_by_bitrix(db, bitrix_user_id, domain)
    if not user:
        return (
            "Профиль в HR Спасибо не найден. Один раз откройте приложение из меню портала и войдите."
        )

    if t in ("баланс", "balance", "/balance"):
        return f"Ваш баланс спасибок: {user.balance}."
    if t in ("help", "помощь", "/help", "start", "/start"):
        return "Команды: «баланс», «помощь». Полный функционал — в приложении в меню портала."
    return "Напишите «баланс» или «помощь». Полный функционал — в приложении в меню портала."
