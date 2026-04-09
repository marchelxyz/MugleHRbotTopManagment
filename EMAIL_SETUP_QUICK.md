# Быстрая настройка Email (Timeweb SMTP)

Полная инструкция: [TIMEWEB_EMAIL_SETUP.md](TIMEWEB_EMAIL_SETUP.md) (в т.ч. **почему SMTP может не работать из контейнера Timeweb Apps**).

## Данные для настройки (Timeweb)

- **SMTP сервер:** `smtp.timeweb.ru` (не `.com`)
- **Порт:** `465` (SSL) или `587` (TLS + `SMTP_USE_TLS` по документации)
- **Логин:** полный адрес ящика, например `noreply@yourdomain.ru`
- **Пароль:** пароль ящика из панели Timeweb (в `.env` не коммитить)

## Настройка в `.env` (`backend/.env`)

```env
SMTP_HOST=smtp.timeweb.ru
SMTP_PORT=465
SMTP_USERNAME=noreply@yourdomain.ru
SMTP_PASSWORD="your-mailbox-password"
SMTP_USE_TLS=false

ADMIN_EMAILS=admin@yourdomain.ru
WEB_APP_LOGIN_URL=https://your-frontend-url.example
```

## Важно

1. **Пароль в кавычках**, если есть спецсимволы; обратный слэш в пароле — **удваивать** в кавычках (см. TIMEWEB_EMAIL_SETUP.md).

2. **Timeweb App Platform (Docker):** исходящий SMTP часто **блокируется** → в логах таймаут к `smtp.timeweb.ru`. На **Vercel / Railway / VPS** с теми же переменными почта может работать — это ограничение **сети контейнера**, не «сломался пароль».

3. После смены `.env` перезапустите процесс / передеплойте приложение.

## Если не работает

| Ошибка в логах | Что проверить |
|----------------|----------------|
| `535` / `Incorrect authentication data` | Логин, пароль, кавычки в `.env` |
| `Timed out connecting` / `SMTPConnectTimeoutError` | Исходящий доступ с хоста (особенно Apps); поддержка Timeweb |
