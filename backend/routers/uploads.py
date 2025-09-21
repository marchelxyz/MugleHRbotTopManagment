# backend/routers/uploads.py (НОВЫЙ ФАЙЛ)

from fastapi import APIRouter, UploadFile, File, HTTPException, status
from PIL import Image # Библиотека для обработки изображений
import io
import os
import uuid

router = APIRouter(prefix="/uploads", tags=["uploads"])

# Указываем, куда сохранять обработанные картинки
UPLOAD_DIR = "static/images"
os.makedirs(UPLOAD_DIR, exist_ok=True) # Создаем папку, если ее нет

@router.post("/image")
async def upload_and_convert_image(file: UploadFile = File(...)):
    """
    Принимает изображение, изменяет размер до 100x100,
    конвертирует в WebP и возвращает публичный URL.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File provided is not an image.")

    try:
        # Читаем содержимое файла в память
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))

        # 1. Изменяем размер до 100x100, сохраняя пропорции (thumbnail)
        image.thumbnail((300, 300))

        # 2. Генерируем уникальное имя файла
        filename = f"{uuid.uuid4()}.webp"
        filepath = os.path.join(UPLOAD_DIR, filename)
        
        # 3. Сохраняем в формате WebP с оптимизацией
        image.save(filepath, 'webp', quality=85)

        # 4. Возвращаем публичный URL для доступа к файлу
        # ВАЖНО: Убедись, что твой сервер настроен на раздачу статики из папки /static
        public_url = f"/static/images/{filename}"
        return {"url": public_url}

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to process image: {e}")
