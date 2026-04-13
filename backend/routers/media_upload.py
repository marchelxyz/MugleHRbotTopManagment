"""Админ-загрузка изображений в объектное хранилище с конвертацией в AVIF."""

import asyncio
import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

import schemas
from config import settings
from dependencies import get_current_admin_user
from image_avif import encode_image_bytes_to_avif
from models import User
from object_storage import (
    generate_media_object_key,
    is_object_storage_configured,
    upload_bytes,
)

logger = logging.getLogger(__name__)

router = APIRouter()

def _content_type_allowed(content_type: str) -> bool:
    """Проверяет MIME до чтения файла (часть клиентов шлёт пустой тип или octet-stream)."""
    if not content_type:
        return True
    if content_type.startswith("image/"):
        return True
    if content_type == "application/octet-stream":
        return True
    return False


@router.get("/admin/media/status", response_model=schemas.AdminMediaStatusResponse)
async def get_media_upload_status(
    _admin: User = Depends(get_current_admin_user),
) -> schemas.AdminMediaStatusResponse:
    """Проверка, настроено ли объектное хранилище для загрузки из админки."""
    return schemas.AdminMediaStatusResponse(enabled=is_object_storage_configured())


@router.post("/admin/media/upload", response_model=schemas.AdminMediaUploadResponse)
async def upload_admin_image(
    _admin: User = Depends(get_current_admin_user),
    file: UploadFile = File(...),
) -> schemas.AdminMediaUploadResponse:
    """Принимает изображение, конвертирует в AVIF и загружает в S3 (Timeweb / совместимое API)."""
    if not is_object_storage_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Объектное хранилище не настроено (S3_BUCKET, ключи доступа).",
        )
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if not _content_type_allowed(content_type):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неподдерживаемый тип файла: {content_type or '(пусто)'}",
        )
    raw = await file.read()
    try:
        avif_bytes = await asyncio.to_thread(
            encode_image_bytes_to_avif,
            raw,
            max_side=settings.IMAGE_MAX_SIDE_PX,
            quality=settings.IMAGE_AVIF_QUALITY,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    key = generate_media_object_key()
    try:
        url = await asyncio.to_thread(upload_bytes, key, avif_bytes, "image/avif")
    except RuntimeError as exc:
        logger.exception("S3 upload failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    return schemas.AdminMediaUploadResponse(url=url, content_type="image/avif")
