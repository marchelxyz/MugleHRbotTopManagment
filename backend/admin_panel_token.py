"""Подписанные токены входа в админ-панель по email + пароль из настроек."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any, Optional

from config import settings


_KIND = "admin_panel"
_TOKEN_TTL_SEC = 7 * 24 * 3600


def admin_panel_allowed_emails() -> set[str]:
    """Нормализованные email из ADMIN_EMAILS (через запятую)."""
    raw = (settings.ADMIN_EMAILS or "").strip()
    if not raw:
        return set()
    return {p.strip().lower() for p in raw.split(",") if p.strip()}


def create_admin_panel_token(email: str) -> tuple[str, int]:
    """Возвращает (token, expires_in_seconds)."""
    normalized = email.strip().lower()
    now = int(time.time())
    payload: dict[str, Any] = {
        "kind": _KIND,
        "email": normalized,
        "exp": now + _TOKEN_TTL_SEC,
        "iat": now,
    }
    body = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    body_b64 = base64.urlsafe_b64encode(body.encode()).decode().rstrip("=")
    sig = hmac.new(
        settings.ADMIN_API_KEY.encode(),
        body_b64.encode(),
        hashlib.sha256,
    ).hexdigest()
    token = f"{body_b64}.{sig}"
    return token, _TOKEN_TTL_SEC


def verify_admin_panel_token(token: str) -> Optional[str]:
    """
    Проверяет подпись и срок. Возвращает нормализованный email или None.
    """
    if not token or "." not in token:
        return None
    try:
        body_b64, sig = token.rsplit(".", 1)
        expected = hmac.new(
            settings.ADMIN_API_KEY.encode(),
            body_b64.encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        pad = (-len(body_b64)) % 4
        if pad:
            body_b64 += "=" * pad
        payload = json.loads(base64.urlsafe_b64decode(body_b64))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return None
    if payload.get("kind") != _KIND:
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
