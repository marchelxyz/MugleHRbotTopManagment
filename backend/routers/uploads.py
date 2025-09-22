# backend/routers/uploads.py

from fastapi import APIRouter, UploadFile, File, HTTPException, status
import cloudinary
import cloudinary.uploader
from config import settings # Импортируем наши настройки

router = APIRouter(prefix="/uploads", tags=["uploads"])

# Конфигурируем Cloudinary с нашими ключами
cloudinary.config(
  cloud_name = settings.CLOUDINARY_CLOUD_NAME, 
  api_key = settings.CLOUDINARY_API_KEY, 
  api_secret = settings.CLOUDINARY_API_SECRET,
  secure = True
)

@router.post("/image")
async def upload_image_to_cloudinary(file: UploadFile = File(...)):
    """
    Принимает изображение, загружает его в Cloudinary с автоматической
    конвертацией и возвращает безопасный URL.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is not an image.")

    try:
        # Загружаем файл в Cloudinary
        upload_result = cloudinary.uploader.upload(
            file.file, 
            # Задаем параметры для Cloudinary:
            # - папка для хранения
            # - автоматическое преобразование в webp лучшего качества
            # - изменение размера до 300x300 (с сохранением пропорций и обрезкой)
            folder="hr_bot_items",
            transformation=[
                {'width': 300, 'height': 300, 'crop': 'fill'},
                {'fetch_format': 'auto', 'quality': 'auto'}
            ]
        )
        # Cloudinary возвращает много данных, нам нужен безопасный URL
        secure_url = upload_result.get('secure_url')
        if not secure_url:
            raise HTTPException(500, "Cloudinary did not return a URL.")
            
        # Теперь мы возвращаем ПОЛНЫЙ, АБСОЛЮТНЫЙ URL из облака
        return {"url": secure_url}

    except Exception as e:
        print(f"!!! Ошибка при загрузке в Cloudinary: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to upload image: {e}")
