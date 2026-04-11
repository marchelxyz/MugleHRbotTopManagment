"""Вход в админ-панель по email из ADMIN_EMAILS и паролю ADMIN_PANEL_PASSWORD."""

import secrets

from fastapi import APIRouter, Depends, HTTPException, status

import schemas
from admin_panel_token import admin_panel_allowed_emails, create_admin_panel_token
from config import settings
from dependencies import get_current_admin_panel_bearer_email

router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])


@router.post("/login", response_model=schemas.AdminPanelLoginResponse)
async def admin_panel_login(body: schemas.AdminPanelLoginRequest) -> schemas.AdminPanelLoginResponse:
    """Выдаёт Bearer-токен при совпадении email (из ADMIN_EMAILS) и пароля."""
    allowed = admin_panel_allowed_emails()
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ADMIN_EMAILS не задан в настройках",
        )
    if not (settings.ADMIN_PANEL_PASSWORD or "").strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ADMIN_PANEL_PASSWORD не задан",
        )
    email_norm = body.email.strip().lower()
    if email_norm not in allowed:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )
    if not secrets.compare_digest(body.password, settings.ADMIN_PANEL_PASSWORD):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )
    token, ttl = create_admin_panel_token(email_norm)
    user = schemas.panel_admin_user_response(email_norm)
    return schemas.AdminPanelLoginResponse(
        access_token=token,
        token_type="bearer",
        expires_in=ttl,
        user=user,
    )


@router.get("/me", response_model=schemas.AdminPanelMeResponse)
async def admin_panel_me(
    email: str = Depends(get_current_admin_panel_bearer_email),
) -> schemas.AdminPanelMeResponse:
    """Проверка Bearer-токена и профиль панельного админа."""
    return schemas.AdminPanelMeResponse(user=schemas.panel_admin_user_response(email))
