"""Сохранение портала Bitrix24 и привязка пользователей HR к учётным записям Bitrix."""

from __future__ import annotations

import logging
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

import crud
import models
import schemas
from bitrix_service import bitrix_rest_user_get

logger = logging.getLogger(__name__)


async def upsert_bitrix_portal(db: AsyncSession, auth: dict[str, Any]) -> models.BitrixPortal:
    """Создаёт или обновляет запись портала по member_id и domain из auth установки."""
    from bitrix_service import auth_expires_at, normalize_bitrix_domain

    domain = auth.get("domain")
    member_id = auth.get("member_id")
    if not domain or not member_id:
        raise ValueError("В auth отсутствуют domain или member_id")

    dom = normalize_bitrix_domain(str(domain))
    member = str(member_id)
    expires_at = auth_expires_at(auth)
    application_token = auth.get("application_token")
    if application_token is not None:
        application_token = str(application_token)
    client_endpoint = auth.get("client_endpoint")
    if client_endpoint is not None:
        client_endpoint = str(client_endpoint)

    result = await db.execute(select(models.BitrixPortal).where(models.BitrixPortal.member_id == member))
    portal = result.scalars().first()
    if portal is None:
        portal = models.BitrixPortal(
            domain=dom,
            member_id=member,
        )
        db.add(portal)

    portal.domain = dom
    portal.access_token = auth.get("access_token")
    portal.refresh_token = auth.get("refresh_token")
    portal.expires_at = expires_at
    portal.application_token = application_token
    portal.client_endpoint = client_endpoint

    await db.commit()
    await db.refresh(portal)
    return portal


async def get_bitrix_portal_by_domain(db: AsyncSession, domain: str) -> Optional[models.BitrixPortal]:
    """Возвращает портал по домену."""
    from bitrix_service import normalize_bitrix_domain

    dom = normalize_bitrix_domain(domain)
    result = await db.execute(select(models.BitrixPortal).where(models.BitrixPortal.domain == dom))
    return result.scalars().first()


async def find_user_by_bitrix(
    db: AsyncSession,
    bitrix_user_id: int,
    domain: str,
) -> Optional[models.User]:
    """Ищет пользователя по паре bitrix_user_id + bitrix_domain."""
    from bitrix_service import normalize_bitrix_domain

    dom = normalize_bitrix_domain(domain)
    q = select(models.User).where(
        models.User.bitrix_user_id == bitrix_user_id,
        models.User.bitrix_domain == dom,
    )
    result = await db.execute(q)
    return result.scalars().first()


async def find_user_by_email_case_insensitive(db: AsyncSession, email: str) -> Optional[models.User]:
    """Ищет пользователя по email без учёта регистра."""
    em = email.strip().lower()
    if not em:
        return None
    result = await db.execute(
        select(models.User).where(func.lower(models.User.email) == em)
    )
    return result.scalars().first()


def _merge_profile_fields(current: dict[str, Any], extra: dict[str, Any]) -> dict[str, Any]:
    """Объединяет поля user.current и user.get (extra не перезаписывает непустые значения)."""
    out = dict(current)
    for key, val in extra.items():
        if val is None or val == "":
            continue
        if key not in out or out[key] in (None, ""):
            out[key] = val
    return out


def _pick_phone_from_profile(profile: dict[str, Any], member_id: str, bitrix_uid: int) -> str:
    """Выбирает телефон из профиля Bitrix или генерирует уникальный заполнитель."""
    for key in ("PERSONAL_MOBILE", "WORK_PHONE", "PERSONAL_PHONE"):
        val = profile.get(key)
        if val and str(val).strip():
            return str(val).strip()[:64]
    return f"bx_{member_id}_{bitrix_uid}"[:64]


def _pick_names(profile: dict[str, Any]) -> tuple[str, str]:
    """Имя и фамилия для RegisterRequest."""
    first = profile.get("NAME") or ""
    last = profile.get("LAST_NAME") or ""
    first = str(first).strip() if first else ""
    last = str(last).strip() if last else ""
    if not last:
        last = "Пользователь"
    return first, last


def _pick_position_department(profile: dict[str, Any]) -> tuple[str, str]:
    """Должность и подразделение (значения по умолчанию при отсутствии в Bitrix)."""
    pos = profile.get("WORK_POSITION") or profile.get("UF_USR_POSITION") or ""
    dep = profile.get("UF_DEPARTMENT") or ""
    pos = str(pos).strip() if pos else "Сотрудник"
    dep = str(dep).strip() if dep else "Компания"
    return pos, dep


async def get_or_create_user_for_bitrix(
    db: AsyncSession,
    domain: str,
    access_token: str,
) -> models.User:
    """
    Проверяет токен через user.current, при необходимости user.get,
    находит или создаёт пользователя и привязывает Bitrix ID.
    """
    from bitrix_service import bitrix_rest_user_current, normalize_bitrix_domain

    dom = normalize_bitrix_domain(domain)
    current = await bitrix_rest_user_current(dom, access_token)
    uid_raw = current.get("ID")
    if uid_raw is None:
        raise ValueError("Bitrix user.current не вернул ID")
    bitrix_uid = int(uid_raw)

    existing = await find_user_by_bitrix(db, bitrix_uid, dom)
    if existing:
        return existing

    extra = await bitrix_rest_user_get(dom, access_token, bitrix_uid)
    profile = _merge_profile_fields(current, extra if extra else {})

    email_raw = profile.get("EMAIL")
    email = str(email_raw).strip() if email_raw else None

    if email:
        by_email = await find_user_by_email_case_insensitive(db, email)
        if by_email:
            by_email.bitrix_user_id = bitrix_uid
            by_email.bitrix_domain = dom
            await db.commit()
            await db.refresh(by_email)
            return by_email

    member_row = await get_bitrix_portal_by_domain(db, dom)
    member_id = member_row.member_id if member_row else "unknown"

    first_name, last_name = _pick_names(profile)
    position, department = _pick_position_department(profile)
    phone = _pick_phone_from_profile(profile, member_id, bitrix_uid)

    register = schemas.RegisterRequest(
        telegram_id=None,
        first_name=first_name,
        last_name=last_name,
        position=position,
        department=department,
        username=None,
        telegram_photo_url=None,
        phone_number=phone,
        date_of_birth=None,
        email=email,
    )

    new_user = await crud.create_user(db, register)
    u = await crud.get_user(db, new_user.id)
    if u is None:
        raise RuntimeError("Не удалось загрузить пользователя после создания")
    u.bitrix_user_id = bitrix_uid
    u.bitrix_domain = dom
    await db.commit()
    await db.refresh(u)
    return u
