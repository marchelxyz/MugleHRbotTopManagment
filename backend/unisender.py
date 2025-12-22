"""
Модуль для работы с Unisender API для отправки email уведомлений.

ВАЖНО: На бесплатном тарифе Unisender можно отправлять письма только на подтвержденные email адреса.

Настройка подтверждения email:
- В файле .env установите UNISENDER_DOUBLE_OPTIN:
  * 0 - подтверждение не требуется (может не работать на бесплатном тарифе)
  * 1 - требуется подтверждение (отправляется письмо пользователю) - РЕКОМЕНДУЕТСЯ для бесплатного тарифа
  * 3 - добавить без отправки письма (для транзакционных писем, но на бесплатном тарифе все равно требуется подтверждение)

Альтернативы Unisender:
См. файл UNISENDER_EMAIL_SOLUTIONS.md для списка бесплатных альтернатив (Resend, Brevo, SendGrid и др.)
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
    
    async def subscribe_email(
        self,
        email: str,
        list_id: Optional[str] = None,
        double_optin: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Добавляет email адрес в базу Unisender перед отправкой письма.
        Необходимо для бесплатного тарифа - можно отправлять только на подтвержденные адреса.
        
        Документация: https://www.unisender.com/ru/support/api/contacts/subscribe/
        
        Args:
            email: Email адрес для добавления
            list_id: ID списка для добавления (если не указан, используется из настроек)
            double_optin: 0 - подтверждение не требуется, 1 - требуется подтверждение, 
                         3 - добавить без отправки письма (рекомендуется для транзакционных писем)
        
        Returns:
            Результат подписки от API
        """
        if not self.is_configured():
            logger.warning("Unisender не настроен. Пропускаем добавление email в базу.")
            return {"success": False, "error": "Unisender не настроен"}
        
        if not email or not email.strip():
            logger.warning(f"Не указан email для добавления в базу. Пропускаем.")
            return {"success": False, "error": "Email не указан"}
        
        try:
            # Используем list_id из настроек, если не передан явно
            if not list_id:
                list_id = getattr(settings, 'UNISENDER_LIST_ID', None)
            
            if not list_id:
                logger.warning("UNISENDER_LIST_ID не указан. Невозможно добавить email в базу.")
                return {"success": False, "error": "UNISENDER_LIST_ID не указан"}
            
            # Используем значение из настроек, если не передано явно
            if double_optin is None:
                double_optin = getattr(settings, 'UNISENDER_DOUBLE_OPTIN', 3)
            
            email_to_subscribe = email.strip()
            optin_mode_desc = {
                0: "без подтверждения",
                1: "с отправкой письма подтверждения",
                3: "добавить без отправки письма (для транзакционных)"
            }.get(double_optin, f"режим {double_optin}")
            
            logger.info(
                f"Добавление email {email_to_subscribe} в базу Unisender (список ID: {list_id}, "
                f"double_optin={double_optin} - {optin_mode_desc})"
            )
            params = {
                "format": "json",
                "api_key": self.api_key,
                "list_ids": list_id,
                "fields[email]": email_to_subscribe,
                "double_optin": str(double_optin),
                "overwrite": "1"  # Перезаписать существующие данные
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.api_url}/subscribe",
                    data=params
                )
                response.raise_for_status()
                
                response_text = response.text
                logger.debug(f"Ответ от UniSender API subscribe (raw): {response_text}")
                
                try:
                    result = response.json()
                except ValueError as json_error:
                    logger.error(f"Не удалось распарсить JSON ответ от UniSender API subscribe: {json_error}, ответ: {response_text}")
                    return {"success": False, "error": f"Неверный формат ответа от API: {str(json_error)}"}
                
                logger.debug(f"Ответ от UniSender API subscribe (parsed): {result}")
                
                if not isinstance(result, dict):
                    logger.error(f"Неожиданный формат ответа от API subscribe для {email}: {type(result).__name__}, ответ: {result}")
                    return {"success": False, "error": f"Неожиданный формат ответа: {type(result).__name__}"}
                
                # Проверяем успешность добавления
                if result.get("result"):
                    optin_note = ""
                    if double_optin == 1:
                        optin_note = "Пользователю отправлено письмо подтверждения. Email будет доступен для отправки после подтверждения."
                    elif double_optin == 3:
                        optin_note = (
                            "Примечание: на бесплатном тарифе Unisender может потребоваться подтверждение email пользователем "
                            "перед отправкой писем, даже при использовании double_optin=3. "
                            "Для гарантированной доставки используйте double_optin=1."
                        )
                    
                    logger.info(
                        f"Email {email} успешно добавлен в базу Unisender (список ID: {list_id}, double_optin={double_optin}). "
                        f"{optin_note}"
                    )
                    return {"success": True}
                else:
                    error = result.get("error", "Неизвестная ошибка")
                    error_code = result.get("code", "")
                    error_msg = (error if isinstance(error, str) else str(error)) + (f" (код: {error_code})" if error_code else "")
                    logger.warning(
                        f"Не удалось добавить email {email} в базу Unisender (список ID: {list_id}): {error_msg}. "
                        f"Это может привести к ошибкам при отправке писем на бесплатном тарифе."
                    )
                    return {"success": False, "error": error_msg}
                    
        except httpx.HTTPError as e:
            logger.error(f"HTTP ошибка при добавлении email {email} в базу Unisender: {e}")
            return {"success": False, "error": f"HTTP ошибка: {str(e)}"}
        except Exception as e:
            logger.error(f"Неожиданная ошибка при добавлении email {email} в базу Unisender: {e}")
            return {"success": False, "error": f"Ошибка: {str(e)}"}
    
    async def send_email(
        self,
        email: str,
        subject: str,
        body: str,
        body_html: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Отправляет email через Unisender API используя метод sendEmail.
        
        Документация: https://www.unisender.com/ru/support/api/messages/sendemail/
        
        Примечания:
        - Сообщения через sendEmail не подвергаются цензуре, но имеют ограничения:
          * Для новых пользователей: до 1000 писем в сутки
          * Максимальный размер письма: 1 МБ
          * Ограничение по вызовам: 60 в минуту
          * Минимальный интервал между отправкой одному адресату: 60 секунд
        - На бесплатном тарифе можно отправлять только на подтвержденные email адреса
        - Для транзакционных писем без ограничений рекомендуется использовать Unisender Go
        
        Args:
            email: Email получателя
            subject: Тема письма
            body: Текст письма (plain text)
            body_html: HTML версия письма (опционально)
        
        Returns:
            Результат отправки от API с полями:
            - success: bool - успешность отправки
            - email_id: str - ID отправленного письма (при успехе)
            - error: str - описание ошибки (при неудаче)
            - error_codes: list - коды ошибок (при использовании error_checking=1)
        """
        if not self.is_configured():
            logger.warning("Unisender не настроен. Пропускаем отправку email.")
            return {"success": False, "error": "Unisender не настроен"}
        
        if not email or not email.strip():
            logger.warning(f"Не указан email получателя. Пропускаем отправку.")
            return {"success": False, "error": "Email получателя не указан"}
        
        # Получаем list_id из настроек (используется и для subscribe, и для sendEmail)
        list_id = getattr(settings, 'UNISENDER_LIST_ID', None)
        
        # На бесплатном тарифе Unisender можно отправлять только на адреса, добавленные в базу и подтвержденные
        # Пытаемся добавить адрес в базу перед отправкой (если еще не добавлен)
        email_added_to_base = False
        if list_id:
            # Используем настройку из конфига для double_optin
            double_optin = getattr(settings, 'UNISENDER_DOUBLE_OPTIN', 3)
            logger.info(f"Попытка добавить email {email} в базу Unisender перед отправкой письма")
            subscribe_result = await self.subscribe_email(email, list_id=list_id, double_optin=double_optin)
            if subscribe_result.get("success"):
                email_added_to_base = True
                logger.info(f"Email {email} успешно добавлен в базу Unisender, продолжаем отправку письма")
            else:
                error_msg = subscribe_result.get('error', 'Неизвестная ошибка')
                logger.warning(
                    f"Не удалось добавить {email} в базу Unisender перед отправкой: {error_msg}. "
                    f"Продолжаем попытку отправки письма. На бесплатном тарифе Unisender требуется подтверждение email адресов."
                )
        else:
            logger.warning("UNISENDER_LIST_ID не указан, пропускаем добавление email в базу перед отправкой")
        
        try:
            # Используем метод sendEmail из Unisender API
            # Согласно документации: https://www.unisender.com/ru/support/api/messages/sendemail/
            # Unisender использует GET запросы с параметрами в URL или POST с form-data
            email_to_send = email.strip()
            logger.info(f"Отправка email через Unisender на адрес: {email_to_send}")
            params = {
                "format": "json",
                "api_key": self.api_key,
                "email": email_to_send,
                "sender_name": self.sender_name,
                "sender_email": self.sender_email,
                "subject": subject,
                "body": body_html if body_html else body,
                "error_checking": "1",  # Рекомендуется использовать для получения детальной информации об ошибках
            }
            
            # Добавляем list_id если указан (обязательный параметр согласно документации)
            if list_id:
                params["list_id"] = list_id
            else:
                logger.warning(
                    "UNISENDER_LIST_ID не указан в настройках. "
                    "Согласно документации Unisender, параметр list_id является обязательным. "
                    "Отправка может завершиться ошибкой."
                )
            
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
                
                # При использовании error_checking=1 формат ответа меняется:
                # возвращается массив объектов с полями index, email, id, errors
                if isinstance(result_data, list) and len(result_data) > 0:
                    # Новый формат ответа с error_checking=1
                    email_result = result_data[0]  # Берем первый результат
                    email_from_response = email_result.get("email")
                    email_address = email_from_response if email_from_response else email
                    logger.debug(f"Email из ответа API: {email_from_response}, исходный email: {email}, используемый email: {email_address}")
                    email_id = email_result.get("id")
                    errors = email_result.get("errors", [])
                    
                    if errors:
                        # Есть ошибки
                        error_messages = []
                        error_codes = []
                        for err in errors:
                            error_code = err.get("code", "")
                            error_message = err.get("message", "")
                            error_messages.append(f"{error_message} (код: {error_code})" if error_code else error_message)
                            error_codes.append(error_code)
                        
                        error_msg = "; ".join(error_messages)
                        error_code_str = ", ".join(error_codes) if error_codes else ""
                        
                        # Специальная обработка ошибки о неподтвержденном email на бесплатном плане
                        is_free_plan_error = (
                            "invalid_arg" in error_codes or 
                            any("free plan" in msg.lower() or "confirmed emails" in msg.lower() or "own confirmed emails" in msg.lower() for msg in error_messages)
                        )
                        if is_free_plan_error:
                            status_info = "был добавлен в базу" if email_added_to_base else "не был добавлен в базу"
                            logger.warning(
                                f"Не удалось отправить email на {email_address}: "
                                f"на бесплатном плане Unisender можно отправлять письма только на email адреса, "
                                f"которые добавлены в вашу базу Unisender и подтверждены. "
                                f"Email {status_info} перед отправкой. "
                                f"Убедитесь, что адрес {email_address} добавлен в список с ID {list_id} через метод subscribe "
                                f"и подтвержден пользователем (на бесплатном тарифе требуется подтверждение даже с double_optin=3). "
                                f"Ошибки: {error_msg}"
                            )
                        else:
                            logger.error(f"Ошибка отправки email на {email_address}: {error_msg}, полный ответ: {result}")
                        
                        return {"success": False, "error": error_msg, "error_codes": error_codes}
                    elif email_id:
                        # Успешная отправка
                        logger.info(f"Email успешно отправлен на {email_address}, email_id: {email_id}")
                        return {"success": True, "email_id": email_id}
                    else:
                        # Неожиданный формат
                        logger.warning(f"Неожиданный формат ответа для email {email_address}: {email_result}")
                        return {"success": False, "error": "Неожиданный формат ответа от API"}
                elif isinstance(result_data, dict) and result_data.get("email_id"):
                    # Старый формат ответа (без error_checking=1 или при успехе)
                    email_id = result_data.get("email_id")
                    logger.info(f"Email успешно отправлен на {email}, email_id: {email_id}")
                    return {"success": True, "email_id": email_id}
                else:
                    # Обрабатываем ошибки API в старом формате
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
                    
                    # Специальная обработка ошибки о неподтвержденном email на бесплатном плане
                    is_free_plan_error = (
                        error_code == "invalid_arg" or
                        "free plan" in error_text.lower() or
                        "confirmed emails" in error_text.lower() or
                        "own confirmed emails" in error_text.lower() or
                        "подтвержденные email" in error_text.lower() or
                        "подтвержденные адреса" in error_text.lower()
                    )
                    
                    if is_free_plan_error:
                        status_info = "был добавлен в базу" if email_added_to_base else "не был добавлен в базу"
                        logger.warning(
                            f"Не удалось отправить email на {email}: "
                            f"на бесплатном плане Unisender можно отправлять письма только на email адреса, "
                            f"которые добавлены в вашу базу Unisender и подтверждены. "
                            f"Email {status_info} перед отправкой. "
                            f"Убедитесь, что адрес {email} добавлен в список с ID {list_id} через метод subscribe "
                            f"и подтвержден пользователем (на бесплатном тарифе требуется подтверждение даже с double_optin=3). "
                            f"Ошибка: {error_msg}"
                        )
                    else:
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
        logger.info(f"send_credentials_email вызван с email: {email} (длина: {len(email)})")
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
        
        # Важно: перед отправкой уведомления администратору нужно убедиться,
        # что его email добавлен в базу Unisender (для бесплатного тарифа)
        # Функция send_email уже делает это автоматически, но добавим явное логирование
        logger.info(f"Отправка уведомления о регистрации администратору на {self.admin_email}")
        return await self.send_email(self.admin_email, subject, body, body_html)


    async def check_email_status(
        self,
        email: str,
        list_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Проверяет статус email в базе Unisender (подтвержден ли email).
        
        Примечание: Unisender может не предоставлять прямой API для проверки статуса.
        Этот метод можно использовать для попытки отправки тестового письма или проверки через другие методы.
        
        Args:
            email: Email адрес для проверки
            list_id: ID списка рассылки
        
        Returns:
            Результат проверки с полями:
            - success: bool - успешность проверки
            - is_confirmed: bool - подтвержден ли email (если удалось определить)
            - error: str - описание ошибки (при неудаче)
        """
        # Unisender не предоставляет прямой API для проверки статуса подтверждения email
        # Вместо этого можно попробовать отправить тестовое письмо минимального размера
        # или использовать другие методы проверки
        
        # Для проверки статуса можно попробовать отправить очень короткое тестовое письмо
        # Если получим ошибку о неподтвержденном email - значит не подтвержден
        # Если письмо отправится - значит подтвержден
        
        logger.info(f"Проверка статуса email {email} в Unisender")
        
        # Пробуем отправить минимальное тестовое письмо для проверки статуса
        test_result = await self.send_email(
            email=email,
            subject="Test",
            body="Test"
        )
        
        if test_result.get("success"):
            return {"success": True, "is_confirmed": True}
        else:
            error_msg = test_result.get("error", "")
            error_codes = test_result.get("error_codes", [])
            is_unconfirmed = (
                "invalid_arg" in error_codes or
                "free plan" in error_msg.lower() or
                "confirmed emails" in error_msg.lower() or
                "own confirmed emails" in error_msg.lower()
            )
            
            if is_unconfirmed:
                return {"success": True, "is_confirmed": False, "error": error_msg}
            else:
                # Другая ошибка - не можем определить статус
                return {"success": False, "is_confirmed": None, "error": error_msg}


# Глобальный экземпляр клиента
unisender_client = UnisenderClient()
