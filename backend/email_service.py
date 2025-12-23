"""
Модуль для отправки email через SMTP Timeweb
"""
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
import logging
from config import settings

logger = logging.getLogger(__name__)


async def send_email(
    to_email: str,
    subject: str,
    body_html: str,
    body_text: Optional[str] = None,
    from_email: Optional[str] = None
) -> bool:
    """
    Отправляет email через SMTP Timeweb
    
    Args:
        to_email: Email получателя
        subject: Тема письма
        body_html: HTML содержимое письма
        body_text: Текстовое содержимое письма (опционально)
        from_email: Email отправителя (если не указан, используется из настроек)
    
    Returns:
        True если письмо отправлено успешно, False в противном случае
    """
    try:
        # Получаем настройки SMTP из конфигурации
        smtp_host = getattr(settings, 'SMTP_HOST', 'smtp.timeweb.ru')
        smtp_port = getattr(settings, 'SMTP_PORT', 465)
        smtp_username = getattr(settings, 'SMTP_USERNAME', None)
        smtp_password = getattr(settings, 'SMTP_PASSWORD', None)
        smtp_use_tls = getattr(settings, 'SMTP_USE_TLS', False)
        
        # Альтернативные хосты для fallback (если основной не работает)
        # Примечание: smtp.timeweb.com не работает (DNS не разрешается), поэтому не добавляем его как fallback
        smtp_hosts = [smtp_host]
        if smtp_host == 'smtp.timeweb.com':
            # Если указан неправильный хост .com, добавляем правильный .ru
            smtp_hosts.append('smtp.timeweb.ru')
            logger.warning("Используется устаревший хост smtp.timeweb.com. Рекомендуется использовать smtp.timeweb.ru")
        
        if not smtp_username or not smtp_password:
            logger.error("SMTP настройки не заданы. Проверьте SMTP_USERNAME и SMTP_PASSWORD в .env")
            return False
        
        # Используем from_email из параметра или из настроек
        sender_email = from_email or smtp_username
        
        # Создаем сообщение
        message = MIMEMultipart('alternative')
        message['From'] = sender_email
        message['To'] = to_email
        message['Subject'] = subject
        
        # Добавляем текстовую и HTML версии
        if body_text:
            text_part = MIMEText(body_text, 'plain', 'utf-8')
            message.attach(text_part)
        
        html_part = MIMEText(body_html, 'html', 'utf-8')
        message.attach(html_part)
        
        # Пробуем отправить через каждый хост из списка (fallback механизм)
        last_error = None
        for host_to_try in smtp_hosts:
            try:
                logger.info(f"Попытка отправки email через {host_to_try}:{smtp_port}")
                
                # Отправляем через SMTP
                if smtp_port == 465:
                    # SSL соединение (порт 465) - используем SMTP_SSL
                    async with aiosmtplib.SMTP(
                        hostname=host_to_try,
                        port=smtp_port,
                        use_tls=True  # SSL через TLS
                    ) as smtp:
                        await smtp.login(smtp_username, smtp_password)
                        await smtp.send_message(message)
                elif smtp_port == 587:
                    # TLS соединение (порт 587) - сначала обычное соединение, потом STARTTLS
                    async with aiosmtplib.SMTP(
                        hostname=host_to_try,
                        port=smtp_port,
                        start_tls=True
                    ) as smtp:
                        await smtp.login(smtp_username, smtp_password)
                        await smtp.send_message(message)
                else:
                    # Другие порты - используем настройки из конфига
                    async with aiosmtplib.SMTP(
                        hostname=host_to_try,
                        port=smtp_port,
                        use_tls=smtp_use_tls,
                        start_tls=not smtp_use_tls if not smtp_use_tls else False
                    ) as smtp:
                        await smtp.login(smtp_username, smtp_password)
                        await smtp.send_message(message)
                
                logger.info(f"Email успешно отправлен на {to_email} через {host_to_try}")
                return True
                
            except Exception as host_error:
                last_error = host_error
                error_msg = str(host_error)
                logger.warning(f"Не удалось отправить через {host_to_try}: {error_msg}")
                
                # Если это ошибка DNS и есть еще хосты для попытки, продолжаем
                if "Name or service not known" in error_msg or "NXDOMAIN" in error_msg:
                    if host_to_try != smtp_hosts[-1]:  # Если это не последний хост
                        logger.info(f"Пробуем альтернативный хост...")
                        continue
                
                # Для других ошибок тоже пробуем следующий хост, если есть
                if host_to_try != smtp_hosts[-1]:
                    continue
        
        # Если все хосты не сработали, выбрасываем последнюю ошибку
        raise last_error if last_error else Exception("Не удалось отправить email через все доступные хосты")
        
    except Exception as e:
        logger.error(f"Ошибка при отправке email на {to_email}: {e}")
        import traceback
        traceback.print_exc()
        return False


async def send_registration_notification_to_admins(
    user_email: Optional[str],
    user_name: str,
    user_department: str,
    user_position: str,
    user_phone: str,
    user_dob: Optional[str],
    is_web_registration: bool
) -> bool:
    """
    Отправляет уведомление администраторам о новой регистрации
    
    Args:
        user_email: Email пользователя (если есть)
        user_name: Имя и фамилия пользователя
        user_department: Отдел пользователя
        user_position: Должность пользователя
        user_phone: Телефон пользователя
        user_dob: Дата рождения пользователя
        is_web_registration: Флаг веб-регистрации
    
    Returns:
        True если уведомление отправлено успешно
    """
    try:
        admin_emails = getattr(settings, 'ADMIN_EMAILS', None)
        if not admin_emails:
            logger.warning("ADMIN_EMAILS не задан в настройках. Уведомление не отправлено.")
            return False
        
        # Парсим список email админов
        admin_email_list = [email.strip() for email in admin_emails.split(',') if email.strip()]
        
        if not admin_email_list:
            logger.warning("Список email админов пуст. Уведомление не отправлено.")
            return False
        
        registration_type = "Веб-регистрация" if is_web_registration else "Telegram-регистрация"
        
        subject = f"Новая заявка на регистрацию - {user_name}"
        
        html_body = f"""
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2c3e50;">Новая заявка на регистрацию</h2>
                
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Тип регистрации:</strong> {registration_type}</p>
                    <p style="margin: 5px 0;"><strong>Имя:</strong> {user_name}</p>
                    <p style="margin: 5px 0;"><strong>Отдел:</strong> {user_department}</p>
                    <p style="margin: 5px 0;"><strong>Должность:</strong> {user_position}</p>
                    <p style="margin: 5px 0;"><strong>Телефон:</strong> {user_phone}</p>
                    {f'<p style="margin: 5px 0;"><strong>Email:</strong> {user_email}</p>' if user_email else ''}
                    {f'<p style="margin: 5px 0;"><strong>Дата рождения:</strong> {user_dob}</p>' if user_dob else ''}
                </div>
                
                <p style="color: #666; font-size: 14px;">
                    Пожалуйста, проверьте заявку в административной панели и примите решение об одобрении или отклонении.
                </p>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
Новая заявка на регистрацию

Тип регистрации: {registration_type}
Имя: {user_name}
Отдел: {user_department}
Должность: {user_position}
Телефон: {user_phone}
{f'Email: {user_email}' if user_email else ''}
{f'Дата рождения: {user_dob}' if user_dob else ''}

Пожалуйста, проверьте заявку в административной панели и примите решение об одобрении или отклонении.
        """
        
        # Отправляем уведомление каждому админу
        success_count = 0
        for admin_email in admin_email_list:
            if await send_email(
                to_email=admin_email,
                subject=subject,
                body_html=html_body,
                body_text=text_body
            ):
                success_count += 1
        
        logger.info(f"Уведомления о регистрации отправлены {success_count} из {len(admin_email_list)} админам")
        return success_count > 0
        
    except Exception as e:
        logger.error(f"Ошибка при отправке уведомления админам о регистрации: {e}")
        import traceback
        traceback.print_exc()
        return False


async def send_credentials_to_user(
    user_email: str,
    user_name: str,
    login: str,
    password: str,
    login_url: Optional[str] = None
) -> bool:
    """
    Отправляет логин и пароль пользователю после одобрения регистрации
    
    Args:
        user_email: Email пользователя
        user_name: Имя и фамилия пользователя
        login: Логин пользователя
        password: Пароль пользователя
        login_url: URL страницы входа (опционально)
    
    Returns:
        True если письмо отправлено успешно
    """
    try:
        subject = "Ваши учетные данные для входа в систему"
        
        login_url_html = f'<p style="margin: 20px 0;"><a href="{login_url}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Войти в систему</a></p>' if login_url else ''
        
        html_body = f"""
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2c3e50;">Добро пожаловать, {user_name}!</h2>
                
                <p>Ваша заявка на регистрацию была одобрена. Ниже указаны ваши учетные данные для входа в систему:</p>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #007bff;">
                    <p style="margin: 10px 0;"><strong>Логин:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px;">{login}</code></p>
                    <p style="margin: 10px 0;"><strong>Пароль:</strong> <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px;">{password}</code></p>
                </div>
                
                <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
                    <p style="margin: 0; color: #856404;"><strong>⚠️ Важно:</strong> Сохраните эти данные в безопасном месте. Рекомендуется изменить пароль после первого входа.</p>
                </div>
                
                {login_url_html}
                
                <p style="color: #666; font-size: 14px; margin-top: 30px;">
                    Если у вас возникли вопросы, обратитесь к администратору системы.
                </p>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
Добро пожаловать, {user_name}!

Ваша заявка на регистрацию была одобрена. Ниже указаны ваши учетные данные для входа в систему:

Логин: {login}
Пароль: {password}

⚠️ Важно: Сохраните эти данные в безопасном месте. Рекомендуется изменить пароль после первого входа.

{f'Ссылка для входа: {login_url}' if login_url else ''}

Если у вас возникли вопросы, обратитесь к администратору системы.
        """
        
        return await send_email(
            to_email=user_email,
            subject=subject,
            body_html=html_body,
            body_text=text_body
        )
        
    except Exception as e:
        logger.error(f"Ошибка при отправке учетных данных пользователю {user_email}: {e}")
        import traceback
        traceback.print_exc()
        return False
