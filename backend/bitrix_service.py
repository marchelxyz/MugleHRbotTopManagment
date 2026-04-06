"""Вызовы REST Bitrix24 и разбор параметра auth при установке приложения."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import unquote, urlencode

import httpx

from config import settings

logger = logging.getLogger(__name__)

BITRIX_OAUTH_TOKEN_URL = "https://oauth.bitrix.info/oauth/token/"
_OAUTH_STATE_MAX_AGE_SEC = 900
_HANDOFF_MAX_AGE_SEC = 300


def normalize_bitrix_domain(domain: str) -> str:
    """Приводит домен портала к виду `portal.bitrix24.ru` без протокола и слэшей."""
    d = domain.strip().lower()
    if d.startswith("https://"):
        d = d[8:]
    if d.startswith("http://"):
        d = d[7:]
    return d.rstrip("/").split("/")[0]


def parse_bitrix_auth_string(raw: str) -> dict[str, Any]:
    """Разбирает JSON из параметра auth (URL-encoded или base64)."""
    raw = raw.strip()
    raw = unquote(raw)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    try:
        pad = "=" * ((4 - len(raw) % 4) % 4)
        decoded = base64.b64decode(raw + pad)
        return json.loads(decoded.decode("utf-8"))
    except Exception as exc:
        raise ValueError("Не удалось разобрать параметр auth") from exc


def parse_install_auth_param(raw: str | None) -> dict[str, Any] | None:
    """Возвращает словарь auth из строки запроса или None."""
    if raw is None or raw == "":
        return None
    return parse_bitrix_auth_string(raw)


def auth_expires_at(auth: dict[str, Any]) -> Optional[datetime]:
    """Срок действия access_token из payload auth (поле expires — unix time)."""
    exp = auth.get("expires")
    if exp is None:
        return None
    try:
        return datetime.fromtimestamp(int(exp), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return None


async def bitrix_rest_user_current(domain: str, access_token: str) -> dict[str, Any]:
    """Вызывает метод user.current."""
    dom = normalize_bitrix_domain(domain)
    url = f"https://{dom}/rest/user.current.json"
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, params={"auth": access_token})
        response.raise_for_status()
        payload = response.json()
    if payload.get("error"):
        raise ValueError(
            payload.get("error_description") or payload.get("error") or "user.current error"
        )
    result = payload.get("result")
    if not isinstance(result, dict):
        raise ValueError("user.current: пустой ответ")
    return result


async def bitrix_rest_user_get(domain: str, access_token: str, user_id: int) -> dict[str, Any]:
    """Вызывает user.get по ID для дополнительных полей (телефон, должность)."""
    dom = normalize_bitrix_domain(domain)
    url = f"https://{dom}/rest/user.get.json"
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            url,
            params={
                "auth": access_token,
                "filter[ID]": str(user_id),
            },
        )
        response.raise_for_status()
        payload = response.json()
    if payload.get("error"):
        logger.warning("user.get: %s", payload.get("error_description"))
        return {}
    rows = payload.get("result")
    if isinstance(rows, list) and rows:
        row = rows[0]
        return row if isinstance(row, dict) else {}
    return {}


async def bitrix_imbot_message_add(
    domain: str,
    access_token: str,
    bot_id: int,
    dialog_id: str,
    message: str,
) -> None:
    """Отправляет сообщение от чат-бота в диалог."""
    dom = normalize_bitrix_domain(domain)
    url = f"https://{dom}/rest/imbot.message.add.json"
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            url,
            data={
                "auth": access_token,
                "BOT_ID": bot_id,
                "DIALOG_ID": dialog_id,
                "MESSAGE": message,
            },
        )
        response.raise_for_status()
        payload = response.json()
    if payload.get("error"):
        raise ValueError(
            payload.get("error_description") or payload.get("error") or "imbot.message.add error"
        )


def _oauth_hmac_secret() -> bytes:
    """Секрет для подписи state/handoff: client_secret приложения или fallback на ADMIN_API_KEY."""
    s = (settings.BITRIX_CLIENT_SECRET or "").strip()
    if s:
        return s.encode("utf-8")
    return settings.ADMIN_API_KEY.encode("utf-8")


def bitrix_oauth_sign_state(domain: str) -> str:
    """Подписывает state для шага /oauth/authorize (защита от подмены портала)."""
    dom = normalize_bitrix_domain(domain)
    payload = json.dumps({"d": dom, "t": int(time.time())}, sort_keys=True)
    sig = hmac.new(_oauth_hmac_secret(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    b64 = base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii").rstrip("=")
    return f"{b64}.{sig}"


def bitrix_oauth_verify_state(state: str) -> str:
    """Проверяет state и возвращает домен портала из подписи."""
    parts = state.rsplit(".", 1)
    if len(parts) != 2:
        raise ValueError("Некорректный state")
    b64, sig = parts
    pad = "=" * ((4 - len(b64) % 4) % 4)
    try:
        raw = base64.urlsafe_b64decode(b64 + pad)
        data = json.loads(raw.decode("utf-8"))
    except (json.JSONDecodeError, ValueError) as exc:
        raise ValueError("Не удалось разобрать state") from exc
    expected_sig = hmac.new(_oauth_hmac_secret(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_sig, sig):
        raise ValueError("Подпись state не совпадает")
    ts = int(data.get("t", 0))
    if int(time.time()) - ts > _OAUTH_STATE_MAX_AGE_SEC:
        raise ValueError("Истёк срок действия state")
    dom = data.get("d")
    if not dom or not isinstance(dom, str):
        raise ValueError("В state нет домена")
    return normalize_bitrix_domain(dom)


def bitrix_oauth_build_authorize_url(domain: str, state: str, redirect_uri: str) -> str:
    """Собирает URL шага авторизации пользователя (см. документацию Bitrix24 OAuth)."""
    dom = normalize_bitrix_domain(domain)
    q = urlencode(
        {
            "client_id": settings.BITRIX_CLIENT_ID,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "state": state,
        }
    )
    return f"https://{dom}/oauth/authorize/?{q}"


async def bitrix_oauth_exchange_code(code: str, redirect_uri: str) -> dict[str, Any]:
    """Обменивает authorization code на access_token (шаг oauth.bitrix.info/oauth/token/)."""
    params = {
        "grant_type": "authorization_code",
        "client_id": settings.BITRIX_CLIENT_ID,
        "client_secret": settings.BITRIX_CLIENT_SECRET,
        "code": code,
        "redirect_uri": redirect_uri,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(BITRIX_OAUTH_TOKEN_URL, params=params)
        if response.status_code >= 400:
            logger.warning("OAuth token GET failed: %s %s", response.status_code, response.text[:500])
            response = await client.post(
                BITRIX_OAUTH_TOKEN_URL,
                data=params,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            txt = exc.response.text[:800] if exc.response else str(exc)
            raise ValueError(f"oauth/token HTTP {exc.response.status_code}: {txt}") from exc
        try:
            data = response.json()
        except json.JSONDecodeError as exc:
            raise ValueError(f"oauth/token: не JSON: {response.text[:500]}") from exc
    err = data.get("error")
    if err:
        raise ValueError(str(data.get("error_description") or err))
    return data


def bitrix_handoff_sign_user_id(user_id: int) -> str:
    """Одноразовый токен для передачи сессии на Vercel после OAuth (короткий срок)."""
    exp = int(time.time()) + _HANDOFF_MAX_AGE_SEC
    payload = json.dumps({"uid": user_id, "exp": exp}, sort_keys=True)
    raw = payload.encode("utf-8")
    sig = hmac.new(_oauth_hmac_secret(), raw, hashlib.sha256).hexdigest()
    b64 = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    return f"{b64}.{sig}"


def bitrix_handoff_verify(token: str) -> int:
    """Проверяет handoff-токен и возвращает user_id."""
    parts = token.rsplit(".", 1)
    if len(parts) != 2:
        raise ValueError("Некорректный токен")
    b64, sig = parts
    pad = "=" * ((4 - len(b64) % 4) % 4)
    try:
        raw = base64.urlsafe_b64decode(b64 + pad)
        data = json.loads(raw.decode("utf-8"))
    except (json.JSONDecodeError, ValueError) as exc:
        raise ValueError("Не удалось разобрать токен") from exc
    expected_sig = hmac.new(_oauth_hmac_secret(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_sig, sig):
        raise ValueError("Подпись токена не совпадает")
    exp = int(data.get("exp", 0))
    if int(time.time()) > exp:
        raise ValueError("Токен истёк")
    uid = data.get("uid")
    if uid is None:
        raise ValueError("Нет uid в токене")
    return int(uid)
