"""
Модуль для работы с Resend API для отправки email уведомлений.

Resend - простой и надежный сервис для отправки транзакционных email.
Документация: https://resend.com/docs/api-reference/emails/send-email
"""
import httpx
from typing import Optional, Dict, Any
from config import settings
import logging

logger = logging.getLogger(__name__)


class ResendClient:
    """Клиент для работы с Resend API."""
    
    def __init__(self):
        self.api_key = getattr(settings, 'RESEND_API_KEY', None)
        self.api_url = "https://api.resend.com/emails"
        self.sender_email = getattr(settings, 'RESEND_SENDER_EMAIL', None)
        self.sender_name = getattr(settings, 'RESEND_SENDER_NAME', '')
        self.admin_email = getattr(settings, 'RESEND_ADMIN_EMAIL', None)
        
    def is_configured(self) -> bool:
        """Проверяет, настроен ли Resend."""
        return bool(self.api_key and self.sender_email)
    
    async def send_email(
        self,
        email: str,
        subject: str,
        body: str,
        body_html: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Отправляет email через Resend API.
        
        Документация: https://resend.com/docs/api-reference/emails/send-email
        
        Args:
            email: Email получателя
            subject: Тема письма
            body: Текст письма (plain text)
            body_html: HTML версия письма (опционально, рекомендуется)
        
        Returns:
            Результат отправки от API с полями:
            - success: bool - успешность отправки
            - email_id: str - ID отправленного письма (при успехе)
            - error: str - описание ошибки (при неудаче)
        """
        if not self.is_configured():
            logger.warning("Resend не настроен. Пропускаем отправку email.")
            return {"success": False, "error": "Resend не настроен"}
        
        if not email or not email.strip():
            logger.warning(f"Не указан email получателя. Пропускаем отправку.")
            return {"success": False, "error": "Email получателя не указан"}
        
        try:
            email_to_send = email.strip()
            logger.info(f"Отправка email через Resend на адрес: {email_to_send}")
            
            # Формируем данные для отправки
            payload = {
                "from": f"{self.sender_name} <{self.sender_email}>" if self.sender_name else self.sender_email,
                "to": [email_to_send],
                "subject": subject,
            }
            
            # Добавляем HTML версию, если есть, иначе plain text
            if body_html:
                payload["html"] = body_html
            if body:
                payload["text"] = body
            
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    self.api_url,
                    json=payload,
                    headers=headers
                )
                
                # Resend возвращает 200 при успехе, но может быть и 4xx/5xx
                response.raise_for_status()
                
                response_text = response.text
                logger.debug(f"Ответ от Resend API (raw): {response_text}")
                
                try:
                    result = response.json()
                except ValueError as json_error:
                    logger.error(f"Не удалось распарсить JSON ответ от Resend API: {json_error}, ответ: {response_text}")
                    return {"success": False, "error": f"Неверный формат ответа от API: {str(json_error)}"}
                
                logger.debug(f"Ответ от Resend API (parsed): {result}")
                
                # Проверяем формат ответа
                if not isinstance(result, dict):
                    logger.error(f"Неожиданный формат ответа от API при отправке email на {email}: {type(result).__name__}, ответ: {result}")
                    return {"success": False, "error": f"Неожиданный формат ответа: {type(result).__name__}"}
                
                # Resend возвращает id при успехе
                email_id = result.get("id")
                error = result.get("error")
                
                if error:
                    error_msg = error.get("message", str(error)) if isinstance(error, dict) else str(error)
                    logger.error(f"Ошибка отправки email на {email}: {error_msg}, полный ответ: {result}")
                    return {"success": False, "error": error_msg}
                elif email_id:
                    logger.info(f"Email успешно отправлен на {email_to_send}, email_id: {email_id}")
                    return {"success": True, "email_id": email_id}
                else:
                    logger.warning(f"Неожиданный формат ответа для email {email_to_send}: {result}")
                    return {"success": False, "error": "Неожиданный формат ответа от API"}
                    
        except httpx.HTTPStatusError as e:
            error_msg = f"HTTP ошибка {e.response.status_code}"
            try:
                error_data = e.response.json()
                if isinstance(error_data, dict) and "message" in error_data:
                    error_msg = error_data["message"]
            except:
                error_msg = e.response.text or str(e)
            logger.error(f"HTTP ошибка при отправке email на {email}: {error_msg}")
            return {"success": False, "error": f"HTTP ошибка: {error_msg}"}
        except httpx.HTTPError as e:
            logger.error(f"HTTP ошибка при отправке email на {email}: {e}")
            return {"success": False, "error": f"HTTP ошибка: {str(e)}"}
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
        logger.info(f"send_credentials_email вызван с email: {email}")
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
        
        logger.info(f"Отправка уведомления о регистрации администратору на email: {self.admin_email}")
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
        
        logger.info(f"Отправка уведомления о регистрации администратору на {self.admin_email}")
        return await self.send_email(self.admin_email, subject, body, body_html)


# Глобальный экземпляр клиента
resend_client = ResendClient()
