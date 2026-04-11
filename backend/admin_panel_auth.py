"""
Вход в админ-панель по переменным окружения без строки в БД.

- Список email: ``ADMIN_EMAILS`` (через запятую), регистр не важен.
- Общий пароль панели: ``ADMIN_PANEL_PASSWORD``.
- Сессия: Bearer-токен, HMAC-SHA256 от ``ADMIN_API_KEY`` по полезной нагрузке JSON.

Поле ``v`` в payload отличает эту реализацию от предыдущей — старые токены после
обновления сервера становятся недействительными.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any, Optional

from config import settings
from models import User

_TOKEN_VERSION = 2
_TOKEN_KIND = "admin_panel_session"
_TTL_SEC = 7 * 24 * 3600


def parse_allowed_emails() -> frozenset[str]:
    """Нормализованные адреса из ``ADMIN_EMAILS``."""
    raw = (settings.ADMIN_EMAILS or "").strip()
    if not raw:
        return frozenset()
    return frozenset(p.strip().lower() for p in raw.split(",") if p.strip())


def panel_auth_env_ready() -> tuple[bool, Optional[str]]:
    """
    Проверяет, заданы ли переменные для входа в панель.

    Returns:
        (True, None) если можно выдавать токены, иначе (False, текст для HTTP 503).
    """
    if not parse_allowed_emails():
        return False, "ADMIN_EMAILS не задан или пуст"
    if not (settings.ADMIN_PANEL_PASSWORD or "").strip():
        return False, "ADMIN_PANEL_PASSWORD не задан"
    return True, None


def _password_matches_config(given: str, expected: str) -> bool:
    """Сравнение пароля в постоянном времени (UTF-8)."""
    try:
        a = given.encode("utf-8")
        b = expected.encode("utf-8")
        return hmac.compare_digest(a, b)
    except (UnicodeEncodeError, TypeError):
        return False


def credentials_valid(normalized_email: str, password: str) -> bool:
    """Email в белом списке и пароль совпадает с ``ADMIN_PANEL_PASSWORD``."""
    if normalized_email not in parse_allowed_emails():
        return False
    return _password_matches_config(password, settings.ADMIN_PANEL_PASSWORD)


def mint_session_token(normalized_email: str) -> tuple[str, int]:
    """
    Выпускает подписанный токен.

    Returns:
        Кортеж (токен, expires_in секунд).
    """
    now = int(time.time())
    payload: dict[str, Any] = {
        "v": _TOKEN_VERSION,
        "kind": _TOKEN_KIND,
        "email": normalized_email,
        "iat": now,
        "exp": now + _TTL_SEC,
    }
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    body_b64 = base64.urlsafe_b64encode(body.encode()).decode().rstrip("=")
    sig = hmac.new(
        settings.ADMIN_API_KEY.encode(),
        body_b64.encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{body_b64}.{sig}", _TTL_SEC


def parse_session_token(token: str) -> Optional[str]:
    """
    Проверяет подпись, версию и срок. Возвращает нормализованный email или None.
    """
    if not token or "." not in token:
        return None
    try:
        body_b64, sig = token.rsplit(".", 1)
        expected_sig = hmac.new(
            settings.ADMIN_API_KEY.encode(),
            body_b64.encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        pad = (-len(body_b64)) % 4
        if pad:
            body_b64 += "=" * pad
        payload = json.loads(base64.urlsafe_b64decode(body_b64))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return None

    if payload.get("v") != _TOKEN_VERSION or payload.get("kind") != _TOKEN_KIND:
        return None
    try:
        exp = int(payload.get("exp", 0))
    except (TypeError, ValueError):
        return None
    if exp < int(time.time()):
        return None
    email = payload.get("email")
    if not isinstance(email, str) or not email.strip():
        return None
    return email.strip().lower()


def synthetic_panel_admin_user(email: str) -> User:
    """ORM-объект только для логов и зависимостей; в БД не сохраняется (id=-1)."""
    normalized = email.strip().lower()
    return User(
        id=-1,
        telegram_id=None,
        first_name="Администратор",
        last_name="панели",
        status="approved",
        position="—",
        department="—",
        username=None,
        phone_number="—",
        email=normalized,
        balance=0,
        reserved_balance=0,
        is_admin=True,
        daily_transfer_count=0,
        ticket_parts=0,
        tickets=0,
        browser_auth_enabled=False,
        has_seen_onboarding=True,
        has_interacted_with_bot=False,
    )
