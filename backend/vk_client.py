"""
Модуль для работы с VK API для отправки сообщений пользователям.
"""
import httpx
from typing import Optional, Dict, Any
from config import settings
import logging

logger = logging.getLogger(__name__)


class VKClient:
    """Клиент для работы с VK API."""
    
    def __init__(self):
        self.api_key = getattr(settings, 'VK_API_KEY', None)
        self.api_version = getattr(settings, 'VK_API_VERSION', '5.131')
        self.api_url = 'https://api.vk.com/method'
        
    def is_configured(self) -> bool:
        """Проверяет, настроен ли VK API."""
        return bool(self.api_key)
    
    async def send_message(
        self,
        user_id: int,
        message: str,
        random_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Отправляет сообщение пользователю через VK API используя метод messages.send.
        
        Документация: https://dev.vk.com/method/messages.send
        
        Args:
            user_id: VK ID пользователя-получателя
            message: Текст сообщения
            random_id: Уникальный идентификатор для предотвращения повторной отправки (опционально)
        
        Returns:
            Результат отправки от API с полями:
            - success: bool - успешность отправки
            - message_id: int - ID отправленного сообщения (при успехе)
            - error: str - описание ошибки (при неудаче)
        """
        if not self.is_configured():
            logger.warning("VK API не настроен. Пропускаем отправку сообщения.")
            return {"success": False, "error": "VK API не настроен"}
        
        if not user_id or user_id <= 0:
            logger.warning(f"Не указан или некорректный VK ID получателя: {user_id}. Пропускаем отправку.")
            return {"success": False, "error": "VK ID получателя не указан или некорректен"}
        
        if not message or not message.strip():
            logger.warning(f"Не указан текст сообщения. Пропускаем отправку.")
            return {"success": False, "error": "Текст сообщения не указан"}
        
        try:
            import random
            import time
            
            # Генерируем random_id если не передан
            if random_id is None:
                random_id = random.randint(1, 2**31 - 1)
            
            logger.info(f"Отправка сообщения через VK API пользователю с ID: {user_id}")
            params = {
                "access_token": self.api_key,
                "v": self.api_version,
                "user_id": user_id,
                "message": message.strip(),
                "random_id": random_id
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.api_url}/messages.send",
                    data=params
                )
                response.raise_for_status()
                
                response_text = response.text
                logger.debug(f"Ответ от VK API (raw): {response_text}")
                
                try:
                    result = response.json()
                except ValueError as json_error:
                    logger.error(f"Не удалось распарсить JSON ответ от VK API: {json_error}, ответ: {response_text}")
                    return {"success": False, "error": f"Неверный формат ответа от API: {str(json_error)}"}
                
                logger.debug(f"Ответ от VK API (parsed): {result}")
                
                # Проверяем наличие ошибки
                if "error" in result:
                    error_data = result["error"]
                    error_code = error_data.get("error_code", "")
                    error_msg = error_data.get("error_msg", "Неизвестная ошибка")
                    
                    logger.error(f"Ошибка отправки сообщения пользователю {user_id}: {error_msg} (код: {error_code})")
                    return {"success": False, "error": error_msg, "error_code": error_code}
                
                # Проверяем успешность отправки
                if "response" in result:
                    message_id = result["response"]
                    logger.info(f"Сообщение успешно отправлено пользователю {user_id}, message_id: {message_id}")
                    return {"success": True, "message_id": message_id}
                else:
                    logger.warning(f"Неожиданный формат ответа от VK API: {result}")
                    return {"success": False, "error": "Неожиданный формат ответа от API"}
                    
        except httpx.HTTPError as e:
            logger.error(f"HTTP ошибка при отправке сообщения пользователю {user_id}: {e}")
            return {"success": False, "error": f"HTTP ошибка: {str(e)}"}
        except ValueError as e:
            logger.error(f"Ошибка парсинга JSON ответа при отправке сообщения пользователю {user_id}: {e}")
            return {"success": False, "error": f"Ошибка парсинга ответа: {str(e)}"}
        except Exception as e:
            logger.error(f"Неожиданная ошибка при отправке сообщения пользователю {user_id}: {e}")
            return {"success": False, "error": f"Ошибка: {str(e)}"}
    
    async def send_credentials_message(
        self,
        user_id: int,
        first_name: str,
        last_name: str,
        login: str,
        password: str
    ) -> Dict[str, Any]:
        """
        Отправляет сообщение с учетными данными пользователю через VK.
        
        Args:
            user_id: VK ID пользователя
            first_name: Имя пользователя
            last_name: Фамилия пользователя
            login: Логин пользователя
            password: Пароль пользователя
        """
        logger.info(f"send_credentials_message вызван с VK ID: {user_id}")
        
        message = f"""Добро пожаловать!

Здравствуйте, {first_name} {last_name}!

Ваша заявка на регистрацию была одобрена. Ниже указаны ваши учетные данные для входа в систему:

🔑 Логин: {login}
🔑 Пароль: {password}

⚠️ Важно: Сохраните эти данные в безопасном месте. Рекомендуем изменить пароль после первого входа.

Теперь вы можете войти в систему, используя указанные выше логин и пароль.

---
Это автоматическое сообщение, пожалуйста, не отвечайте на него."""
        
        return await self.send_message(user_id, message)
    
    async def send_registration_notification(
        self,
        admin_vk_id: int,
        user_email: str,
        first_name: str,
        last_name: str,
        position: str,
        department: str,
        phone_number: str,
        registration_date: str
    ) -> Dict[str, Any]:
        """
        Отправляет уведомление администратору о новой регистрации через веб.
        
        Args:
            admin_vk_id: VK ID администратора
            user_email: Email зарегистрированного пользователя
            first_name: Имя пользователя
            last_name: Фамилия пользователя
            position: Должность
            department: Отдел
            phone_number: Номер телефона
            registration_date: Дата регистрации
        """
        if not admin_vk_id or admin_vk_id <= 0:
            logger.warning("VK ID администратора не настроен. Пропускаем отправку уведомления.")
            return {"success": False, "error": "VK ID администратора не настроен"}
        
        logger.info(f"Отправка уведомления о регистрации администратору с VK ID: {admin_vk_id}")
        
        message = f"""Новая регистрация через веб

Поступила новая заявка на регистрацию через веб-интерфейс:

👤 Имя: {first_name}
👤 Фамилия: {last_name}
📧 Email: {user_email}
💼 Должность: {position}
🏢 Отдел: {department}
📱 Телефон: {phone_number}
📅 Дата регистрации: {registration_date}

Пожалуйста, проверьте заявку в админ-панели и примите решение об одобрении или отклонении.

---
Это автоматическое уведомление."""
        
        return await self.send_message(admin_vk_id, message)


# Глобальный экземпляр клиента
vk_client = VKClient()
