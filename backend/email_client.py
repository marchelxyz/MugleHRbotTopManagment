"""
Универсальный клиент для отправки email с поддержкой разных провайдеров.
Автоматически выбирает провайдера на основе настройки EMAIL_PROVIDER.
"""
from typing import Optional, Dict, Any
from config import settings
from unisender import unisender_client
from resend import resend_client
import logging

logger = logging.getLogger(__name__)


def get_email_client():
    """
    Возвращает клиент для отправки email на основе настройки EMAIL_PROVIDER.
    
    Returns:
        Экземпляр клиента (ResendClient или UnisenderClient)
    """
    provider = getattr(settings, 'EMAIL_PROVIDER', 'resend').lower()
    
    if provider == 'resend':
        if resend_client.is_configured():
            logger.debug("Используется Resend для отправки email")
            return resend_client
        else:
            logger.warning("Resend не настроен, пытаемся использовать Unisender")
            if unisender_client.is_configured():
                return unisender_client
            else:
                logger.error("Ни Resend, ни Unisender не настроены!")
                return None
    elif provider == 'unisender':
        if unisender_client.is_configured():
            logger.debug("Используется Unisender для отправки email")
            return unisender_client
        else:
            logger.warning("Unisender не настроен, пытаемся использовать Resend")
            if resend_client.is_configured():
                return resend_client
            else:
                logger.error("Ни Unisender, ни Resend не настроены!")
                return None
    else:
        logger.warning(f"Неизвестный провайдер email: {provider}, используем Resend по умолчанию")
        if resend_client.is_configured():
            return resend_client
        elif unisender_client.is_configured():
            return unisender_client
        else:
            logger.error("Ни Resend, ни Unisender не настроены!")
            return None


# Глобальный клиент для удобства использования
email_client = get_email_client()
