"""
Модуль для отправки email через SMTP Timeweb
"""
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
import logging
import re
from config import settings

logger = logging.getLogger(__name__)


def is_valid_email(email: str) -> bool:
    """Проверяет, является ли строка валидным email адресом"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def normalize_smtp_password(password: str) -> tuple[str, bool]:
    """
    Нормализует SMTP пароль и проверяет наличие потенциальных проблем с экранированием.
    
    Args:
        password: Исходный пароль из настроек
        
    Returns:
        tuple: (нормализованный_пароль, была_ли_проблема_обнаружена)
    """
    if not password:
        return password, False
    
    has_issue = False
    
    # Проверяем наличие обратных слэшей
    if '\\' in password:
        # Проверяем, есть ли проблемные escape-последовательности
        # Стандартные escape-последовательности: \n, \t, \r, \\, \', \"
        # Если есть \X где X - буква, но не стандартная escape-последовательность,
        # это может быть проблемой
        
        # Проверяем наличие нестандартных escape-последовательностей
        # Например, \Y может быть интерпретировано как escape, если пароль неправильно записан в .env
        problematic_escapes = re.findall(r'\\([a-zA-Z])', password)
        standard_escapes = ['n', 't', 'r', '\\', "'", '"', 'a', 'b', 'f', 'v', '0']
        non_standard = [e for e in problematic_escapes if e not in standard_escapes]
        
        if non_standard:
            logger.warning(
                f"Обнаружены потенциально проблемные escape-последовательности в пароле: {non_standard}. "
                "Если пароль содержит обратный слэш перед буквой, убедитесь, что в .env файле он правильно экранирован."
            )
            has_issue = True
    
    # Проверяем наличие невидимых символов
    invisible_chars = [c for c in password if ord(c) < 32 and c not in ['\n', '\r', '\t']]
    if invisible_chars:
        logger.warning(
            f"В пароле обнаружены невидимые символы (коды: {[ord(c) for c in invisible_chars]}). "
            "Это может указывать на проблему с чтением пароля из .env файла."
        )
        has_issue = True
    
    return password, has_issue


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
        
        # Проверяем, что пароль не пустой и не состоит только из пробелов
        smtp_password = smtp_password.strip() if smtp_password else ""
        if not smtp_password:
            logger.error("SMTP_PASSWORD пустой или содержит только пробелы. Проверьте настройки в .env")
            return False
        
        # Нормализация и проверка пароля
        smtp_password, password_has_issue = normalize_smtp_password(smtp_password)
        
        # Логируем диагностическую информацию о пароле
        password_repr = repr(smtp_password)
        logger.debug(f"Пароль (repr): {password_repr}, длина: {len(smtp_password)}")
        
        if password_has_issue:
            logger.warning(
                "Обнаружены потенциальные проблемы с паролем. "
                "Убедитесь, что в .env файле пароль правильно экранирован:\n"
                "  - Если пароль содержит обратный слэш, используйте: SMTP_PASSWORD=\"j.IIaq-\\\\Ydpm14\" "
                "(удвоенный слэш в двойных кавычках)\n"
                "  - Или используйте одинарные кавычки: SMTP_PASSWORD='j.IIaq-\\Ydpm14' "
                "(одинарный слэш в одинарных кавычках)\n"
                "  - НЕ используйте: SMTP_PASSWORD=\"j.IIaq-\\Ydpm14\" (без удвоения в двойных кавычках) "
                "- это может привести к неправильной интерпретации escape-последовательностей"
            )
        
        # Проверяем, что SMTP_USERNAME является валидным email адресом
        smtp_username = smtp_username.strip()
        if not is_valid_email(smtp_username):
            logger.error(f"SMTP_USERNAME '{smtp_username}' не является валидным email адресом. Укажите полный email (например: support@teleagentnn.ru)")
            return False
        
        # Логируем диагностическую информацию (без полного пароля)
        password_length = len(smtp_password)
        # Показываем первые 2 и последние 2 символа пароля для диагностики
        if password_length > 4:
            password_preview = f"{smtp_password[:2]}...{smtp_password[-2:]}"
        elif password_length > 0:
            password_preview = f"{smtp_password[0]}***"
        else:
            password_preview = "пустой"
        
        # Проверяем наличие специальных символов
        special_chars = [c for c in smtp_password if c in ['\\', '-', '.', '#', '$', '%', '&', '@']]
        special_chars_info = f", содержит спецсимволы: {special_chars}" if special_chars else ""
        
        logger.info(f"SMTP диагностика: username='{smtp_username}', password_length={password_length}, password_preview='{password_preview}'{special_chars_info}")
        
        # Для Timeweb SMTP адрес отправителя должен совпадать с SMTP_USERNAME
        # Это критично для успешной аутентификации
        sender_email = smtp_username
        
        # Если указан from_email и он отличается от smtp_username, используем Reply-To
        # но From всегда должен быть smtp_username для успешной аутентификации
        if from_email and from_email != smtp_username:
            logger.warning(
                f"Параметр from_email ({from_email}) отличается от SMTP_USERNAME ({smtp_username}). "
                f"Для Timeweb SMTP адрес From будет установлен в SMTP_USERNAME для успешной аутентификации. "
                f"Адрес {from_email} будет использован как Reply-To."
            )
        
        # Логируем настройки для диагностики (без пароля)
        logger.info(f"SMTP настройки: host={smtp_host}, port={smtp_port}, username={smtp_username}, from={sender_email}, to={to_email}, password_set={'да' if smtp_password else 'нет'}")
        
        # Создаем сообщение
        message = MIMEMultipart('alternative')
        message['From'] = sender_email
        message['To'] = to_email
        message['Subject'] = subject
        
        # Если указан другой from_email, добавляем его как Reply-To
        if from_email and from_email != smtp_username:
            message['Reply-To'] = from_email
        
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
                    # SSL соединение (порт 465) - используем SSL/TLS
                    # Для Timeweb важно использовать правильные настройки SSL
                    async with aiosmtplib.SMTP(
                        hostname=host_to_try,
                        port=smtp_port,
                        use_tls=True,  # SSL через TLS
                        tls_context=None,  # Используем контекст по умолчанию
                        timeout=30
                    ) as smtp:
                        logger.info(f"Подключение к {host_to_try}:{smtp_port} установлено, выполняется аутентификация...")
                        logger.debug(f"Аутентификация: username='{smtp_username}', password_length={len(smtp_password)}, password_repr={repr(smtp_password[:5])}...")
                        try:
                            await smtp.login(smtp_username, smtp_password)
                            logger.info(f"Аутентификация успешна, отправка сообщения...")
                        except Exception as auth_error:
                            error_msg = str(auth_error)
                            logger.error(f"Ошибка при аутентификации на {host_to_try}: {type(auth_error).__name__}: {error_msg}")
                            logger.error(f"Проверяемые данные: username='{smtp_username}', password_length={len(smtp_password)}")
                            # Показываем первые и последние символы пароля для диагностики
                            if len(smtp_password) > 4:
                                logger.error(f"Password preview: '{smtp_password[:2]}...{smtp_password[-2:]}'")
                            # Проверяем наличие невидимых символов
                            if any(ord(c) < 32 and c not in ['\n', '\r', '\t'] for c in smtp_password):
                                logger.warning("В пароле обнаружены невидимые символы (коды < 32)")
                            raise
                        await smtp.send_message(message)
                elif smtp_port == 587:
                    # TLS соединение (порт 587) - сначала обычное соединение, потом STARTTLS
                    async with aiosmtplib.SMTP(
                        hostname=host_to_try,
                        port=smtp_port,
                        start_tls=True
                    ) as smtp:
                        try:
                            await smtp.login(smtp_username, smtp_password)
                        except Exception as auth_error:
                            error_msg = str(auth_error)
                            logger.error(f"Ошибка при аутентификации на {host_to_try}: {type(auth_error).__name__}: {error_msg}")
                            logger.error(f"Проверяемые данные: username='{smtp_username}', password_length={len(smtp_password)}")
                            if len(smtp_password) > 4:
                                logger.error(f"Password preview: '{smtp_password[:2]}...{smtp_password[-2:]}'")
                            raise
                        await smtp.send_message(message)
                else:
                    # Другие порты - используем настройки из конфига
                    async with aiosmtplib.SMTP(
                        hostname=host_to_try,
                        port=smtp_port,
                        use_tls=smtp_use_tls,
                        start_tls=not smtp_use_tls if not smtp_use_tls else False
                    ) as smtp:
                        try:
                            await smtp.login(smtp_username, smtp_password)
                        except Exception as auth_error:
                            error_msg = str(auth_error)
                            logger.error(f"Ошибка при аутентификации на {host_to_try}: {type(auth_error).__name__}: {error_msg}")
                            logger.error(f"Проверяемые данные: username='{smtp_username}', password_length={len(smtp_password)}")
                            if len(smtp_password) > 4:
                                logger.error(f"Password preview: '{smtp_password[:2]}...{smtp_password[-2:]}'")
                            raise
                        await smtp.send_message(message)
                
                logger.info(f"Email успешно отправлен на {to_email} через {host_to_try}")
                return True
                
            except Exception as host_error:
                last_error = host_error
                error_msg = str(host_error)
                error_type = type(host_error).__name__
                
                # Детальное логирование ошибки
                logger.warning(f"Не удалось отправить через {host_to_try}: {error_type}: {error_msg}")
                
                # Специальная обработка ошибок аутентификации
                if "535" in error_msg or "Incorrect authentication data" in error_msg or "SMTPAuthenticationError" in error_type or "authentication" in error_msg.lower():
                    password_preview = f"{smtp_password[:2]}...{smtp_password[-2:]}" if len(smtp_password) > 4 else "***"
                    logger.error(
                        f"Ошибка аутентификации SMTP на {host_to_try}. "
                        f"Проверьте:\n"
                        f"  1. SMTP_USERNAME должен быть полным email адресом (например: support@teleagentnn.ru)\n"
                        f"     Текущее значение: '{smtp_username}'\n"
                        f"  2. SMTP_PASSWORD должен быть правильным паролем от почтового ящика\n"
                        f"     Длина пароля: {len(smtp_password)} символов\n"
                        f"     Preview: '{password_preview}'\n"
                        f"  3. Убедитесь, что пароль правильно экранирован в .env файле:\n"
                        f"     - Если пароль содержит обратный слэш (\\), удвойте его в .env файле\n"
                        f"     - Пример для пароля 'j.IIaq-\\Ydpm14': SMTP_PASSWORD=\"j.IIaq-\\\\Ydpm14\"\n"
                        f"     - Или используйте одинарные кавычки: SMTP_PASSWORD='j.IIaq-\\Ydpm14'\n"
                        f"     - Если пароль содержит другие спецсимволы (#, $, %, &), заключите его в кавычки\n"
                        f"  4. Для Timeweb адрес From должен совпадать с SMTP_USERNAME\n"
                        f"     From адрес: '{sender_email}'\n"
                        f"  5. Убедитесь, что:\n"
                        f"     - Почтовый ящик существует и активен\n"
                        f"     - Пароль правильный (попробуйте войти через веб-интерфейс Timeweb)\n"
                        f"     - В панели Timeweb включена возможность отправки через SMTP\n"
                        f"     - Не используется двухфакторная аутентификация (или используйте пароль приложения)\n"
                        f"  6. Проверьте правильность пароля:\n"
                        f"     - Запустите скрипт проверки: python backend/check_smtp.py\n"
                        f"     - Или проверьте пароль вручную, войдя в почтовый ящик через веб-интерфейс"
                    )
                    # Для ошибок аутентификации не пробуем другие хосты
                    break
                
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
