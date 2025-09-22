# backend/routers/uploads.py

from fastapi import APIRouter, UploadFile, File, HTTPException, status
from PIL import Image
import io
import os
import uuid
from pathlib import Path # 1. Импортируем pathlib для работы с путями

router = APIRouter(prefix="/uploads", tags=["uploads"])

# --- 2. НАЧАЛО ГЛАВНОГО ИСПРАВЛЕНИЯ ---
# Создаем АБСОЛЮТНЫЙ путь к нашей папке для изображений.
# Path(__file__) -> текущий файл (uploads.py)
# .parent -> папка routers/
# .parent -> папка backend/ (корень нашего приложения)
# / "static" / "images" -> добавляем нужные папки
UPLOAD_DIR = Path(__file__).parent.parent / "static" / "images"
# --- КОНЕЦ ГЛАВНОГО ИСПРАВЛЕНИЯ ---

# Убеждаемся, что директория существует
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/image")
async def upload_and_convert_image(file: UploadFile = File(...)):
    """
    Принимает изображение, изменяет размер до 300x300,
    конвертирует в WebP и возвращает публичный URL.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File provided is not an image.")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        image.thumbnail((300, 300))

        filename = f"{uuid.uuid4()}.webp"
        # Теперь мы используем абсолютный путь для сохранения
        filepath = UPLOAD_DIR / filename
        
        image.save(filepath, 'webp', quality=85)

        # Публичный URL остается относительным, это правильно
        public_url = f"/static/images/{filename}"
        return {"url": public_url}

    except Exception as e:
        # Добавим вывод ошибки в лог для лучшей диагностики
        print(f"!!! Ошибка при обработке изображения: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to process image: {e}")
