"""Загрузка файлов в S3-совместимое хранилище (в т.ч. Yandex Object Storage)."""

import uuid
from datetime import datetime, timezone
import boto3
from botocore.exceptions import ClientError

from config import settings


def is_object_storage_configured() -> bool:
    """Возвращает True, если заданы параметры для загрузки в бакет."""
    return bool(
        settings.S3_BUCKET.strip()
        and settings.S3_ACCESS_KEY_ID.strip()
        and settings.S3_SECRET_ACCESS_KEY.strip()
    )


def build_public_url(key: str) -> str:
    """Собирает публичный URL объекта для отображения в интерфейсе."""
    base = settings.S3_PUBLIC_BASE_URL.strip().rstrip("/")
    if base:
        return f"{base}/{key}"
    bucket = settings.S3_BUCKET.strip()
    endpoint = settings.S3_ENDPOINT_URL.strip().rstrip("/")
    return f"{endpoint}/{bucket}/{key}"


def generate_media_object_key(prefix: str = "media") -> str:
    """Уникальный ключ с префиксом по дате (UTC)."""
    now = datetime.now(timezone.utc)
    unique = uuid.uuid4().hex
    return f"{prefix}/{now:%Y/%m}/{unique}.avif"


def upload_bytes(key: str, body: bytes, content_type: str) -> str:
    """Загружает байты в бакет и возвращает публичный URL.

    Raises:
        RuntimeError: Ошибка API хранилища.
    """
    session = boto3.session.Session()
    client = session.client(
        service_name="s3",
        endpoint_url=settings.S3_ENDPOINT_URL.strip(),
        aws_access_key_id=settings.S3_ACCESS_KEY_ID.strip(),
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY.strip(),
        region_name=settings.S3_REGION.strip() or "ru-central1",
    )
    put_kwargs: dict[str, str | bytes] = {
        "Bucket": settings.S3_BUCKET.strip(),
        "Key": key,
        "Body": body,
        "ContentType": content_type,
        "CacheControl": "public, max-age=31536000",
    }
    acl = settings.S3_OBJECT_ACL.strip()
    if acl:
        put_kwargs["ACL"] = acl
    try:
        client.put_object(**put_kwargs)
    except ClientError as exc:
        raise RuntimeError(f"Ошибка загрузки в объектное хранилище: {exc}") from exc
    return build_public_url(key)
