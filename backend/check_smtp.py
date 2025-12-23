#!/usr/bin/env python3
"""
Скрипт для проверки настроек SMTP и диагностики проблем с отправкой email
"""
import asyncio
import sys
from config import settings
from email_service import send_email, normalize_smtp_password

async def test_smtp():
    """Тестирует настройки SMTP"""
    print("=" * 60)
    print("Проверка настроек SMTP")
    print("=" * 60)
    
    # Проверяем настройки
    smtp_host = getattr(settings, 'SMTP_HOST', None)
    smtp_port = getattr(settings, 'SMTP_PORT', None)
    smtp_username = getattr(settings, 'SMTP_USERNAME', None)
    smtp_password = getattr(settings, 'SMTP_PASSWORD', None)
    
    print(f"\n1. SMTP_HOST: {smtp_host}")
    print(f"2. SMTP_PORT: {smtp_port}")
    print(f"3. SMTP_USERNAME: {smtp_username}")
    
    if smtp_password:
        password_length = len(smtp_password)
        # Показываем первые и последние символы
        if password_length > 4:
            preview = f"{smtp_password[:2]}...{smtp_password[-2:]}"
        else:
            preview = "***"
        print(f"4. SMTP_PASSWORD: длина={password_length}, preview='{preview}'")
        
        # Проверяем специальные символы
        special_chars = [c for c in smtp_password if c in ['\\', '-', '.', '#', '$', '%', '&', '@']]
        if special_chars:
            print(f"   Специальные символы в пароле: {special_chars}")
        
        # Показываем repr для диагностики экранирования
        print(f"   repr(password[:10]): {repr(smtp_password[:10])}")
        
        # Проверяем пароль на наличие проблем с экранированием
        normalized_password, has_issue = normalize_smtp_password(smtp_password)
        if has_issue:
            print("   ⚠️  Обнаружены потенциальные проблемы с экранированием пароля!")
            print("   Проверьте формат пароля в .env файле (см. инструкции выше)")
    else:
        print("4. SMTP_PASSWORD: НЕ ЗАДАН!")
    
    # Проверяем наличие всех необходимых настроек
    if not smtp_username or not smtp_password:
        print("\n❌ ОШИБКА: SMTP_USERNAME или SMTP_PASSWORD не заданы в .env файле")
        print("\nДобавьте в backend/.env:")
        print('SMTP_USERNAME=support@teleagentnn.ru')
        print('SMTP_PASSWORD="j.IIaq-\\\\Ydpm14"')
        return False
    
    # Пробуем отправить тестовое письмо
    print("\n" + "=" * 60)
    print("Попытка отправки тестового email...")
    print("=" * 60)
    
    test_email = smtp_username  # Отправляем на тот же адрес, что и отправитель
    print(f"Отправка тестового письма на {test_email}...")
    
    success = await send_email(
        to_email=test_email,
        subject="Тестовое письмо - проверка SMTP",
        body_html="<p>Это тестовое письмо для проверки настроек SMTP.</p>",
        body_text="Это тестовое письмо для проверки настроек SMTP."
    )
    
    if success:
        print("\n✅ УСПЕХ! Тестовое письмо отправлено успешно.")
        print(f"Проверьте почтовый ящик {test_email}")
        return True
    else:
        print("\n❌ ОШИБКА: Не удалось отправить тестовое письмо.")
        print("\nВозможные причины:")
        print("1. Неправильный пароль в .env файле")
        print("2. Пароль неправильно экранирован в .env файле")
        print("3. Почтовый ящик не существует или заблокирован")
        print("4. SMTP не включен в панели Timeweb")
        print("\nПроверьте логи выше для детальной информации.")
        return False

if __name__ == "__main__":
    try:
        result = asyncio.run(test_smtp())
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\n\nПрервано пользователем")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ КРИТИЧЕСКАЯ ОШИБКА: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
