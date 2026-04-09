"""
Модуль для отправки email через SMTP Timeweb
"""
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
import logging
import re
import json
from config import settings

logger = logging.getLogger(__name__)


def is_valid_email(email: str) -> bool:
    """Проверяет, является ли строка валидным email адресом"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


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
        
        # Дополнительная проверка: если пароль выглядит как неправильно экранированный (содержит \Y вместо \\Y)
        # Это может произойти, если в .env файле пароль записан без кавычек или с одинарным обратным слэшем
        # Но мы не можем автоматически исправлять, так как это может быть правильный пароль
        # Просто логируем предупреждение
        if '\\Y' in smtp_password and '\\\\Y' not in smtp_password:
            logger.warning(
                "В пароле обнаружен одинарный обратный слэш перед Y. "
                "Если пароль содержит обратный слэш, убедитесь, что в .env файле он правильно экранирован: "
                'SMTP_PASSWORD="sec\\\\ret" (удвоенный \\ внутри кавычек для пароля с обратным слэшем)'
            )
        
        # Проверяем, что SMTP_USERNAME является валидным email адресом
        smtp_username = smtp_username.strip()
        if not is_valid_email(smtp_username):
            logger.error(
                f"SMTP_USERNAME '{smtp_username}' не является валидным email адресом. "
                "Укажите полный email (например: noreply@yourdomain.ru)"
            )
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
                        f"  1. SMTP_USERNAME должен быть полным email адресом (например: noreply@yourdomain.ru)\n"
                        f"     Текущее значение: '{smtp_username}'\n"
                        f"  2. SMTP_PASSWORD должен быть правильным паролем от почтового ящика\n"
                        f"     Длина пароля: {len(smtp_password)} символов\n"
                        f"     Preview: '{password_preview}'\n"
                        f"  3. Убедитесь, что пароль правильно экранирован в .env файле:\n"
                        f"     - Если пароль содержит обратный слэш (\\), удвойте его в .env файле\n"
                        f"     - Пример: пароль `a\\b` в .env → SMTP_PASSWORD=\"a\\\\b\"\n"
                        f"     - Или одинарные кавычки в .env: SMTP_PASSWORD='a\\b'\n"
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
        if "Timed out connecting" in str(e) or type(e).__name__ == "SMTPConnectTimeoutError":
            logger.error(
                "Таймаут SMTP: с хоста (часто Timeweb App Platform / Docker) исходящий доступ к "
                "smtp.timeweb.ru:465 может быть закрыт — это не обязательно неверный пароль. "
                "См. TIMEWEB_EMAIL_SETUP.md в корне репозитория, раздел про среду выполнения."
            )
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
        
        login_url_html = f'<div style="text-align: center; margin: 20px 0;"><a href="{login_url}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Войти в систему</a></div>' if login_url else ''
        
        # Экранируем логин и пароль для безопасного использования в JavaScript
        login_escaped = json.dumps(login)
        password_escaped = json.dumps(password)
        
        # JavaScript для копирования (работает в большинстве современных email клиентов)
        copy_script = """
        <script>
        function copyToClipboard(text, buttonId) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function() {
                    var btn = document.getElementById(buttonId);
                    var originalText = btn.textContent;
                    btn.textContent = '✓ Скопировано!';
                    btn.style.backgroundColor = '#28a745';
                    setTimeout(function() {
                        btn.textContent = originalText;
                        btn.style.backgroundColor = '#6c757d';
                    }, 2000);
                }).catch(function(err) {
                    alert('Не удалось скопировать. Скопируйте вручную: ' + text);
                });
            } else {
                // Fallback для старых браузеров
                var textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    var btn = document.getElementById(buttonId);
                    var originalText = btn.textContent;
                    btn.textContent = '✓ Скопировано!';
                    btn.style.backgroundColor = '#28a745';
                    setTimeout(function() {
                        btn.textContent = originalText;
                        btn.style.backgroundColor = '#6c757d';
                    }, 2000);
                } catch (err) {
                    alert('Не удалось скопировать. Скопируйте вручную: ' + text);
                }
                document.body.removeChild(textArea);
            }
        }
        </script>
        """
        
        html_body = f"""
        <html>
        <head>
            <meta charset="UTF-8">
            {copy_script}
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2c3e50;">Добро пожаловать, {user_name}!</h2>
                
                <p>Ваша заявка на регистрацию была одобрена. Ниже указаны ваши учетные данные для входа в систему:</p>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #007bff;">
                    <div style="margin: 10px 0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <strong>Логин:</strong> 
                        <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px; flex: 1; min-width: 100px;">{login}</code>
                        <button id="copy-login-btn" onclick="copyToClipboard({login_escaped}, 'copy-login-btn')" style="background-color: #6c757d; color: white; border: none; padding: 5px 12px; border-radius: 3px; cursor: pointer; font-size: 12px; white-space: nowrap;">📋 Копировать</button>
                    </div>
                    <div style="margin: 10px 0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <strong>Пароль:</strong> 
                        <code style="background-color: #e9ecef; padding: 2px 6px; border-radius: 3px; flex: 1; min-width: 100px;">{password}</code>
                        <button id="copy-password-btn" onclick="copyToClipboard({password_escaped}, 'copy-password-btn')" style="background-color: #6c757d; color: white; border: none; padding: 5px 12px; border-radius: 3px; cursor: pointer; font-size: 12px; white-space: nowrap;">📋 Копировать</button>
                    </div>
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


async def send_purchase_confirmation_to_user(
    to_email: str,
    user_name: str,
    item_name: str,
    amount: int,
    issued_code: Optional[str] = None,
    purchase_type: str = "regular",
) -> bool:
    """
    Отправляет пользователю подтверждение покупки и код (если есть).

    Args:
        to_email: Email получателя.
        user_name: Имя пользователя.
        item_name: Название товара.
        amount: Стоимость в спасибках.
        issued_code: Код/ссылка для автовыдачи (опционально).
        purchase_type: Тип покупки (regular, local, statix, shared).

    Returns:
        True если письмо отправлено успешно.
    """
    if not to_email or not is_valid_email(to_email):
        return False
    try:
        type_labels = {
            "regular": "Покупка в магазине",
            "local": "Локальный подарок",
            "statix": "Бонусы Statix",
            "shared": "Совместный подарок",
        }
        type_label = type_labels.get(purchase_type, "Покупка")

        subject = f"{type_label}: {item_name}"

        code_block = ""
        if issued_code:
            code_block = f"""
                <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #4caf50;">
                    <p style="margin: 0 0 8px 0;"><strong>Ваш код/ссылка:</strong></p>
                    <code style="background-color: #fff; padding: 8px 12px; border-radius: 4px; display: block; word-break: break-all; font-size: 14px;">{issued_code}</code>
                </div>
            """

        html_body = f"""
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2c3e50;">Покупка подтверждена</h2>
                <p>Здравствуйте, {user_name}!</p>
                <p>Ваша покупка успешно оформлена.</p>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Товар:</strong> {item_name}</p>
                    <p style="margin: 5px 0;"><strong>Стоимость:</strong> {amount} спасибок</p>
                </div>
                {code_block}
                <p style="color: #666; font-size: 14px;">Спасибо, что пользуетесь нашим магазином!</p>
            </div>
        </body>
        </html>
        """

        text_parts = [
            f"Здравствуйте, {user_name}!",
            "",
            "Ваша покупка успешно оформлена.",
            f"Товар: {item_name}",
            f"Стоимость: {amount} спасибок",
        ]
        if issued_code:
            text_parts.extend(["", "Ваш код/ссылка:", issued_code])
        text_parts.extend(["", "Спасибо, что пользуетесь нашим магазином!"])
        text_body = "\n".join(text_parts)

        return await send_email(
            to_email=to_email,
            subject=subject,
            body_html=html_body,
            body_text=text_body,
        )
    except Exception as e:
        logger.error(f"Ошибка при отправке подтверждения покупки на {to_email}: {e}")
        return False


async def send_local_gift_status_to_user(
    to_email: str,
    user_name: str,
    item_name: str,
    amount: int,
    approved: bool,
) -> bool:
    """Отправляет пользователю уведомление об одобрении или отклонении локального подарка."""
    if not to_email or not is_valid_email(to_email):
        return False
    try:
        if approved:
            subject = f"Локальный подарок одобрен: {item_name}"
            status_text = "одобрен"
            status_color = "#4caf50"
        else:
            subject = f"Локальный подарок отклонён: {item_name}"
            status_text = "отклонён"
            status_color = "#f44336"

        html_body = f"""
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2c3e50;">Локальный подарок {status_text}</h2>
                <p>Здравствуйте, {user_name}!</p>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid {status_color};">
                    <p style="margin: 5px 0;"><strong>Товар:</strong> {item_name}</p>
                    <p style="margin: 5px 0;"><strong>Стоимость:</strong> {amount} спасибок</p>
                </div>
                <p style="color: #666; font-size: 14px;">
                    {f"Спасибки списаны с вашего баланса." if approved else "Спасибки возвращены на ваш баланс."}
                </p>
            </div>
        </body>
        </html>
        """
        text_body = f"Здравствуйте, {user_name}!\n\nЛокальный подарок {status_text}.\nТовар: {item_name}\nСтоимость: {amount} спасибок"
        return await send_email(to_email=to_email, subject=subject, body_html=html_body, body_text=text_body)
    except Exception as e:
        logger.error(f"Ошибка при отправке уведомления о локальном подарке на {to_email}: {e}")
        return False


async def send_purchase_notification_to_admins(
    purchase_type: str,
    user_name: str,
    user_phone: str,
    user_email: Optional[str],
    item_name: str,
    amount: int,
    issued_code: Optional[str] = None,
    extra_info: Optional[str] = None,
) -> bool:
    """
    Отправляет админам уведомление о покупке (любого типа).

    Args:
        purchase_type: regular, local, statix, shared.
        user_name: Имя покупателя.
        user_phone: Телефон.
        user_email: Email (если есть).
        item_name: Название товара.
        amount: Стоимость.
        issued_code: Код для автовыдачи (опционально).
        extra_info: Доп. текст (город, ссылка, приглашённый и т.д.).

    Returns:
        True если хотя бы одно письмо отправлено.
    """
    try:
        admin_emails = getattr(settings, "ADMIN_EMAILS", None)
        if not admin_emails:
            return False
        admin_list = [e.strip() for e in admin_emails.split(",") if e.strip()]
        if not admin_list:
            return False

        type_labels = {
            "regular": "Покупка в магазине",
            "local": "Локальный подарок",
            "statix": "Бонусы Statix",
            "shared": "Совместный подарок",
        }
        type_label = type_labels.get(purchase_type, "Покупка")

        subject = f"{type_label}: {item_name} — {user_name}"

        code_block = ""
        if issued_code:
            code_block = f'<p style="margin: 5px 0;"><strong>Код/ссылка:</strong> <code>{issued_code}</code></p>'
        extra_block = f"<p>{extra_info}</p>" if extra_info else ""

        html_body = f"""
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2c3e50;">{type_label}</h2>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Покупатель:</strong> {user_name}</p>
                    <p style="margin: 5px 0;"><strong>Телефон:</strong> {user_phone or "не указан"}</p>
                    {f'<p style="margin: 5px 0;"><strong>Email:</strong> {user_email}</p>' if user_email else ""}
                    <p style="margin: 5px 0;"><strong>Товар:</strong> {item_name}</p>
                    <p style="margin: 5px 0;"><strong>Стоимость:</strong> {amount} спасибок</p>
                    {code_block}
                </div>
                {extra_block}
            </div>
        </body>
        </html>
        """

        success = 0
        for admin_email in admin_list:
            if await send_email(to_email=admin_email, subject=subject, body_html=html_body):
                success += 1
        return success > 0
    except Exception as e:
        logger.error(f"Ошибка при отправке уведомления админам о покупке: {e}")
        return False


def build_broadcast_email_content(
    body_plain: str,
    login_url: Optional[str] = None,
) -> tuple[str, str]:
    """Формирует HTML и текст письма для массовой рассылки (текст экранируется).

    Args:
        body_plain: Текст сообщения от администратора.
        login_url: Если задан, в конец добавляется блок со ссылкой для входа.

    Returns:
        Кортеж (body_html, body_text) для send_email.
    """
    import html as html_mod

    stripped = body_plain.strip()
    text_parts = [stripped]
    if login_url:
        text_parts.append("")
        text_parts.append(f"Ссылка для входа: {login_url}")
    body_text = "\n".join(text_parts)

    escaped = html_mod.escape(stripped)
    inner = escaped.replace("\n", "<br/>")
    html_chunks: list[str] = [
        "<html><head><meta charset=\"UTF-8\"></head><body>",
        "<div style=\"max-width:600px;margin:0 auto;padding:20px;font-family:Arial,sans-serif;"
        "line-height:1.6;color:#333;\">",
        f"<p style=\"margin:0;\">{inner}</p>",
    ]
    if login_url:
        safe_url = html_mod.escape(login_url, quote=True)
        html_chunks.append(
            "<p style=\"margin-top:20px;\">"
            f"<a href=\"{safe_url}\" style=\"color:#007bff;\">Перейти по ссылке для входа</a></p>"
            f"<p style=\"font-size:12px;color:#666;word-break:break-all;\">{html_mod.escape(login_url)}</p>"
        )
    html_chunks.extend(["</div>", "</body></html>"])
    body_html = "".join(html_chunks)
    return body_html, body_text
