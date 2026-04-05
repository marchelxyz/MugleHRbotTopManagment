"""Вызовы REST Bitrix24 и разбор параметра auth при установке приложения."""

from __future__ import annotations

import base64
import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import unquote

import httpx

logger = logging.getLogger(__name__)


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
