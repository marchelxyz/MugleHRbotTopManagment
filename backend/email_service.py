"""
Сервис для отправки email через Unisender API
"""
import httpx
import logging
from typing import Optional
from config import settings

logger = logging.getLogger(__name__)


async def send_registration_approval_email(
    email: str,
    login: str,
    password: str,
    user_name: str
) -> bool:
    """
    Отправляет email с учетными данными при одобрении регистрации.
    
    Args:
        email: Email адрес получателя
        login: Логин пользователя
        password: Пароль пользователя
        user_name: Имя пользователя для персонализации
        
    Returns:
        True если письмо отправлено успешно, False в противном случае
    """
    if not settings.UNISENDER_API_KEY:
        logger.warning("UNISENDER_API_KEY не настроен, отправка email пропущена")
        return False
    
    if not settings.UNISENDER_SENDER_EMAIL:
        logger.warning("UNISENDER_SENDER_EMAIL не настроен, отправка email пропущена")
        return False
    
    if not email:
        logger.warning(f"Email адрес не указан для пользователя {user_name}, отправка пропущена")
        return False
    
    # Формируем HTML шаблон письма
    email_subject = "Ваша регистрация одобрена"
    email_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c3e50;">Добро пожаловать, {user_name}!</h2>
            
            <p>Ваша регистрация была успешно одобрена.</p>
            
            <div style="background-color: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #007bff;">Ваши учетные данные для входа:</h3>
                <p style="margin: 10px 0;"><strong>Логин:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px;">{login}</code></p>
                <p style="margin: 10px 0;"><strong>Пароль:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px;">{password}</code></p>
            </div>
            
            <p style="color: #dc3545; font-weight: bold;">⚠️ Важно: Сохраните эти данные в безопасном месте!</p>
            
            <p>Рекомендуем изменить пароль после первого входа в систему.</p>
            
            <p>Если у вас возникнут вопросы, обратитесь к администратору системы.</p>
            
            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
            <p style="color: #6c757d; font-size: 12px;">Это автоматическое сообщение, пожалуйста, не отвечайте на него.</p>
        </div>
    </body>
    </html>
    """
    
    # Параметры для Unisender API
    params = {
        "format": "json",
        "api_key": settings.UNISENDER_API_KEY,
        "email": email,
        "sender_name": settings.UNISENDER_SENDER_NAME,
        "sender_email": settings.UNISENDER_SENDER_EMAIL,
        "subject": email_subject,
        "body": email_body,
        "list_id": "",  # Опционально: ID списка рассылки
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                settings.UNISENDER_API_URL,
                data=params
            )
            response.raise_for_status()
            result = response.json()
            
            # Unisender возвращает результат в формате:
            # {"result": {"email_id": "..."}, "error": null} при успехе
            # {"result": null, "error": "..."} при ошибке
            
            if result.get("error"):
                logger.error(f"Ошибка Unisender при отправке email на {email}: {result.get('error')}")
                return False
            
            if result.get("result"):
                logger.info(f"Email успешно отправлен на {email} для пользователя {user_name}")
                return True
            else:
                logger.warning(f"Неожиданный ответ от Unisender при отправке на {email}: {result}")
                return False
                
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP ошибка при отправке email на {email}: {e.response.status_code} - {e.response.text}")
        return False
    except httpx.RequestError as e:
        logger.error(f"Ошибка запроса при отправке email на {email}: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Неожиданная ошибка при отправке email на {email}: {str(e)}")
        return False
