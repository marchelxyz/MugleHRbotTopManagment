"""
Модуль для работы с Unisender API для отправки email уведомлений.
"""
import httpx
from typing import Optional, Dict, Any
from config import settings
import logging

logger = logging.getLogger(__name__)


class UnisenderClient:
    """Клиент для работы с Unisender API."""
    
    def __init__(self):
        self.api_key = getattr(settings, 'UNISENDER_API_KEY', None)
        self.api_url = getattr(settings, 'UNISENDER_API_URL', 'https://api.unisender.com/ru/api')
        self.sender_name = getattr(settings, 'UNISENDER_SENDER_NAME', '')
        self.sender_email = getattr(settings, 'UNISENDER_SENDER_EMAIL', '')
        self.admin_email = getattr(settings, 'UNISENDER_ADMIN_EMAIL', '')
        
    def is_configured(self) -> bool:
        """Проверяет, настроен ли Unisender."""
        return bool(self.api_key and self.sender_email)
    
    async def send_email(
        self,
        email: str,
        subject: str,
        body: str,
        body_html: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Отправляет email через Unisender API.
        
        Args:
            email: Email получателя
            subject: Тема письма
            body: Текст письма (plain text)
            body_html: HTML версия письма (опционально)
        
        Returns:
            Результат отправки от API
        """
        if not self.is_configured():
            logger.warning("Unisender не настроен. Пропускаем отправку email.")
            return {"success": False, "error": "Unisender не настроен"}
        
        if not email or not email.strip():
            logger.warning(f"Не указан email получателя. Пропускаем отправку.")
            return {"success": False, "error": "Email получателя не указан"}
        
        try:
            # Используем метод sendEmail из Unisender API
            # Unisender использует GET запросы с параметрами в URL или POST с form-data
            params = {
                "format": "json",
                "api_key": self.api_key,
                "email": email.strip(),
                "sender_name": self.sender_name,
                "sender_email": self.sender_email,
                "subject": subject,
                "body": body_html if body_html else body,
            }
            
            # Добавляем list_id если указан
            list_id = getattr(settings, 'UNISENDER_LIST_ID', None)
            if list_id:
                params["list_id"] = list_id
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Согласно документации UniSender, метод sendEmail поддерживает как GET, так и POST
                # Используем POST для большей надежности, особенно при передаче HTML контента
                response = await client.post(
                    f"{self.api_url}/sendEmail",
                    data=params
                )
                response.raise_for_status()
                
                # Получаем текст ответа для логирования
                response_text = response.text
                logger.debug(f"Ответ от UniSender API (raw): {response_text}")
                
                try:
                    result = response.json()
                except ValueError as json_error:
                    logger.error(f"Не удалось распарсить JSON ответ от UniSender API: {json_error}, ответ: {response_text}")
                    return {"success": False, "error": f"Неверный формат ответа от API: {str(json_error)}"}
                
                # Логируем распарсенный ответ для отладки
                logger.debug(f"Ответ от UniSender API (parsed): {result}")
                
                # Проверяем, что result - это словарь
                if not isinstance(result, dict):
                    logger.error(f"Неожиданный формат ответа от API при отправке email на {email}: {type(result).__name__}, ответ: {result}")
                    return {"success": False, "error": f"Неожиданный формат ответа: {type(result).__name__}"}
                
                # Безопасно получаем поле result из ответа
                result_data = result.get("result")
                
                # Проверяем успешность отправки
                # Согласно документации UniSender, при успехе возвращается {"result": {"email_id": "..."}}
                if isinstance(result_data, dict) and result_data.get("email_id"):
                    email_id = result_data.get("email_id")
                    logger.info(f"Email успешно отправлен на {email}, email_id: {email_id}")
                    return {"success": True, "email_id": email_id}
                else:
                    # Обрабатываем ошибки API
                    error = result.get("error", "Неизвестная ошибка")
                    error_code = result.get("code", "")
                    
                    # Если error - это словарь, извлекаем текст ошибки
                    if isinstance(error, dict):
                        error_text = error.get("text", str(error))
                    elif isinstance(error, str):
                        error_text = error
                    else:
                        error_text = str(error)
                    
                    error_msg = error_text + (f" (код: {error_code})" if error_code else "")
                    logger.error(f"Ошибка отправки email на {email}: {error_msg}, полный ответ: {result}")
                    return {"success": False, "error": error_msg}
                    
        except httpx.HTTPError as e:
            logger.error(f"HTTP ошибка при отправке email на {email}: {e}")
            return {"success": False, "error": f"HTTP ошибка: {str(e)}"}
        except ValueError as e:
            # Ошибка парсинга JSON
            logger.error(f"Ошибка парсинга JSON ответа при отправке email на {email}: {e}")
            return {"success": False, "error": f"Ошибка парсинга ответа: {str(e)}"}
        except Exception as e:
            logger.error(f"Неожиданная ошибка при отправке email на {email}: {e}")
            return {"success": False, "error": f"Ошибка: {str(e)}"}
    
    async def send_credentials_email(
        self,
        email: str,
        first_name: str,
        last_name: str,
        login: str,
        password: str
    ) -> Dict[str, Any]:
        """
        Отправляет email с учетными данными пользователю.
        
        Args:
            email: Email пользователя
            first_name: Имя пользователя
            last_name: Фамилия пользователя
            login: Логин пользователя
            password: Пароль пользователя
        """
        subject = "Ваша заявка одобрена - учетные данные для входа"
        
        # HTML версия письма
        body_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .header {{
                    background-color: #4CAF50;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px 5px 0 0;
                }}
                .content {{
                    background-color: #f9f9f9;
                    padding: 20px;
                    border: 1px solid #ddd;
                    border-top: none;
                }}
                .credentials {{
                    background-color: #fff;
                    padding: 15px;
                    border-left: 4px solid #4CAF50;
                    margin: 20px 0;
                }}
                .credential-item {{
                    margin: 10px 0;
                    font-size: 16px;
                }}
                .label {{
                    font-weight: bold;
                    color: #555;
                }}
                .value {{
                    color: #333;
                    font-family: monospace;
                    background-color: #f5f5f5;
                    padding: 5px 10px;
                    border-radius: 3px;
                }}
                .footer {{
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                    font-size: 12px;
                    color: #777;
                    text-align: center;
                }}
                .warning {{
                    background-color: #fff3cd;
                    border-left: 4px solid #ffc107;
                    padding: 10px;
                    margin: 15px 0;
                    font-size: 14px;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Добро пожаловать!</h1>
            </div>
            <div class="content">
                <p>Здравствуйте, {first_name} {last_name}!</p>
                
                <p>Ваша заявка на регистрацию была одобрена. Ниже указаны ваши учетные данные для входа в систему:</p>
                
                <div class="credentials">
                    <div class="credential-item">
                        <span class="label">Логин:</span><br>
                        <span class="value">{login}</span>
                    </div>
                    <div class="credential-item">
                        <span class="label">Пароль:</span><br>
                        <span class="value">{password}</span>
                    </div>
                </div>
                
                <div class="warning">
                    <strong>⚠️ Важно:</strong> Сохраните эти данные в безопасном месте. Рекомендуем изменить пароль после первого входа.
                </div>
                
                <p>Теперь вы можете войти в систему, используя указанные выше логин и пароль.</p>
            </div>
            <div class="footer">
                <p>Это автоматическое сообщение, пожалуйста, не отвечайте на него.</p>
            </div>
        </body>
        </html>
        """
        
        # Plain text версия
        body = f"""
Здравствуйте, {first_name} {last_name}!

Ваша заявка на регистрацию была одобрена. Ниже указаны ваши учетные данные для входа в систему:

Логин: {login}
Пароль: {password}

⚠️ Важно: Сохраните эти данные в безопасном месте. Рекомендуем изменить пароль после первого входа.

Теперь вы можете войти в систему, используя указанные выше логин и пароль.

---
Это автоматическое сообщение, пожалуйста, не отвечайте на него.
        """
        
        return await self.send_email(email, subject, body, body_html)
    
    async def send_registration_notification(
        self,
        user_email: str,
        first_name: str,
        last_name: str,
        position: str,
        department: str,
        phone_number: str,
        registration_date: str
    ) -> Dict[str, Any]:
        """
        Отправляет уведомление администраторам о новой регистрации через веб.
        
        Args:
            user_email: Email зарегистрированного пользователя
            first_name: Имя пользователя
            last_name: Фамилия пользователя
            position: Должность
            department: Отдел
            phone_number: Номер телефона
            registration_date: Дата регистрации
        """
        if not self.admin_email:
            logger.warning("Email администратора не настроен. Пропускаем отправку уведомления.")
            return {"success": False, "error": "Email администратора не настроен"}
        
        subject = f"Новая регистрация через веб: {first_name} {last_name}"
        
        # HTML версия письма
        body_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .header {{
                    background-color: #2196F3;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px 5px 0 0;
                }}
                .content {{
                    background-color: #f9f9f9;
                    padding: 20px;
                    border: 1px solid #ddd;
                    border-top: none;
                }}
                .info-block {{
                    background-color: #fff;
                    padding: 15px;
                    border-left: 4px solid #2196F3;
                    margin: 10px 0;
                }}
                .info-item {{
                    margin: 8px 0;
                }}
                .label {{
                    font-weight: bold;
                    color: #555;
                    display: inline-block;
                    width: 150px;
                }}
                .value {{
                    color: #333;
                }}
                .footer {{
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                    font-size: 12px;
                    color: #777;
                    text-align: center;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Новая регистрация через веб</h1>
            </div>
            <div class="content">
                <p>Поступила новая заявка на регистрацию через веб-интерфейс:</p>
                
                <div class="info-block">
                    <div class="info-item">
                        <span class="label">Имя:</span>
                        <span class="value">{first_name}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Фамилия:</span>
                        <span class="value">{last_name}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Email:</span>
                        <span class="value">{user_email}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Должность:</span>
                        <span class="value">{position}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Отдел:</span>
                        <span class="value">{department}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Телефон:</span>
                        <span class="value">{phone_number}</span>
                    </div>
                    <div class="info-item">
                        <span class="label">Дата регистрации:</span>
                        <span class="value">{registration_date}</span>
                    </div>
                </div>
                
                <p>Пожалуйста, проверьте заявку в админ-панели и примите решение об одобрении или отклонении.</p>
            </div>
            <div class="footer">
                <p>Это автоматическое уведомление.</p>
            </div>
        </body>
        </html>
        """
        
        # Plain text версия
        body = f"""
Новая регистрация через веб

Поступила новая заявка на регистрацию через веб-интерфейс:

Имя: {first_name}
Фамилия: {last_name}
Email: {user_email}
Должность: {position}
Отдел: {department}
Телефон: {phone_number}
Дата регистрации: {registration_date}

Пожалуйста, проверьте заявку в админ-панели и примите решение об одобрении или отклонении.

---
Это автоматическое уведомление.
        """
        
        return await self.send_email(self.admin_email, subject, body, body_html)


# Глобальный экземпляр клиента
unisender_client = UnisenderClient()
