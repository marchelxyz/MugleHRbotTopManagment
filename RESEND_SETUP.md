# Настройка Resend для отправки email

## Почему Resend?

Resend проще и надежнее Unisender:
- ✅ **Простой API** - один запрос для отправки письма
- ✅ **Не требует подтверждения email** - можно отправлять сразу на любой адрес
- ✅ **Хорошая доставляемость** - письма не попадают в спам
- ✅ **3,000 писем/месяц бесплатно** - достаточно для начала
- ✅ **Отличная документация** - легко интегрировать

## Быстрая настройка

### 1. Регистрация в Resend

1. Перейдите на https://resend.com
2. Зарегистрируйтесь (можно через GitHub)
3. Получите API ключ в разделе "API Keys"

### 2. Добавление домена (обязательно)

Resend требует верификации домена для отправки писем:

1. В панели Resend перейдите в "Domains"
2. Нажмите "Add Domain"
3. Введите ваш домен (например, `yourdomain.com`)
4. Добавьте DNS записи, которые покажет Resend:
   - SPF запись
   - DKIM записи
   - DMARC запись (опционально)

**Примечание:** Если у вас нет своего домена, можно использовать домен Resend для тестирования (`onboarding@resend.dev`), но это только для разработки.

### 3. Настройка переменных окружения

Добавьте в файл `.env`:

```env
# Выбор провайдера email (resend или unisender)
EMAIL_PROVIDER=resend

# Настройки Resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
RESEND_SENDER_EMAIL=noreply@yourdomain.com  # Должен быть верифицированный домен
RESEND_SENDER_NAME=HR Spasibo Bot  # Опционально: имя отправителя
RESEND_ADMIN_EMAIL=admin@yourdomain.com  # Email для уведомлений администраторам
```

### 4. Перезапуск приложения

```bash
# Backend
cd backend
python3 -m uvicorn app:app --reload

# Или если используете systemd/supervisor
sudo systemctl restart your-backend-service
```

## Проверка работы

После настройки система автоматически будет использовать Resend для отправки email. Проверьте логи при отправке:

```
INFO: Используется Resend для отправки email
INFO: Отправка email через Resend на адрес: user@example.com
INFO: Email успешно отправлен на user@example.com, email_id: xxxxxx
```

## Преимущества перед Unisender

| Функция | Resend | Unisender (бесплатный) |
|---------|--------|------------------------|
| Подтверждение email | ❌ Не требуется | ✅ Требуется |
| Простота API | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Доставляемость | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Бесплатный лимит | 3,000/месяц | Ограничен |
| Документация | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

## Переключение обратно на Unisender

Если нужно вернуться к Unisender:

```env
EMAIL_PROVIDER=unisender
# ... настройки Unisender
```

Система автоматически переключится на Unisender.

## Отправка тестового письма

Можно протестировать отправку через API:

```bash
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer re_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "noreply@yourdomain.com",
    "to": ["test@example.com"],
    "subject": "Test",
    "html": "<p>Test email</p>"
  }'
```

## Troubleshooting

### Ошибка: "Domain not verified"

**Решение:** Убедитесь, что:
1. Домен добавлен в Resend
2. DNS записи добавлены правильно
3. Подождите несколько минут для распространения DNS

### Ошибка: "Invalid API key"

**Решение:** Проверьте, что `RESEND_API_KEY` правильный и начинается с `re_`

### Письма не приходят

**Решение:**
1. Проверьте логи приложения
2. Проверьте папку "Spam" получателя
3. Убедитесь, что домен верифицирован
4. Проверьте лимиты в панели Resend

## Дополнительная информация

- Документация Resend: https://resend.com/docs
- API Reference: https://resend.com/docs/api-reference/emails/send-email
- Лимиты: https://resend.com/pricing

## Миграция с Unisender

Если вы переходите с Unisender на Resend:

1. ✅ Настройте Resend (см. выше)
2. ✅ Установите `EMAIL_PROVIDER=resend` в `.env`
3. ✅ Перезапустите приложение
4. ✅ Проверьте отправку тестового письма
5. ✅ Можно оставить настройки Unisender в `.env` на случай отката

**Важно:** При переходе на Resend отложенные учетные данные (pending_credentials_email) будут отправляться автоматически, так как Resend не требует подтверждения email.
