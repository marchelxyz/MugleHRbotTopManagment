# Примеры DNS записей для разных провайдеров

## Cloudflare

### Добавление через веб-интерфейс:

1. **DNS** → **Records** → **Add record**

**SPF (TXT):**
- Type: `TXT`
- Name: `@`
- Content: `v=spf1 include:_spf.resend.com ~all`
- Proxy status: **DNS only** (серый облачко)
- TTL: Auto

**DKIM 1 (CNAME):**
- Type: `CNAME`
- Name: `resend._domainkey`
- Target: `resend._domainkey.resend.com`
- Proxy status: **DNS only**
- TTL: Auto

**DKIM 2 (CNAME):**
- Type: `CNAME`
- Name: `resend2._domainkey`
- Target: `resend2._domainkey.resend.com`
- Proxy status: **DNS only**
- TTL: Auto

**DKIM 3 (CNAME):**
- Type: `CNAME`
- Name: `resend3._domainkey`
- Target: `resend3._domainkey.resend.com`
- Proxy status: **DNS only**
- TTL: Auto

**DMARC (TXT, опционально):**
- Type: `TXT`
- Name: `_dmarc`
- Content: `v=DMARC1; p=none; rua=mailto:dmarc@resend.com`
- Proxy status: **DNS only**
- TTL: Auto

## Namecheap

### Через Advanced DNS:

1. **Domain List** → выберите домен → **Manage** → **Advanced DNS**

**SPF (TXT):**
- Type: `TXT Record`
- Host: `@`
- Value: `v=spf1 include:_spf.resend.com ~all`
- TTL: Automatic

**DKIM (CNAME):**
- Type: `CNAME Record`
- Host: `resend._domainkey`
- Value: `resend._domainkey.resend.com`
- TTL: Automatic

*(Повторите для resend2._domainkey и resend3._domainkey)*

## GoDaddy

### Через DNS Management:

1. **My Products** → **DNS** → **Manage DNS**

**SPF (TXT):**
- Type: `TXT`
- Name: `@`
- Value: `v=spf1 include:_spf.resend.com ~all`
- TTL: 1 Hour

**DKIM (CNAME):**
- Type: `CNAME`
- Name: `resend._domainkey`
- Value: `resend._domainkey.resend.com`
- TTL: 1 Hour

## REG.RU

### Через панель управления:

1. **Домены** → выберите домен → **Управление DNS**

**SPF (TXT):**
- Тип: `TXT`
- Поддомен: `@` (или оставьте пустым)
- Значение: `v=spf1 include:_spf.resend.com ~all`
- TTL: 3600

**DKIM (CNAME):**
- Тип: `CNAME`
- Поддомен: `resend._domainkey`
- Каноническое имя: `resend._domainkey.resend.com`
- TTL: 3600

## Timeweb

### Через панель управления:

1. **Домены** → выберите домен → **DNS-записи**

**SPF (TXT):**
- Тип: `TXT`
- Имя: `@`
- Значение: `v=spf1 include:_spf.resend.com ~all`
- TTL: 3600

**DKIM (CNAME):**
- Тип: `CNAME`
- Имя: `resend._domainkey`
- Значение: `resend._domainkey.resend.com`
- TTL: 3600

## Яндекс.Почта для домена

### Через Яндекс.Коннект:

1. **Почта** → **Настройки** → **Почтовые домены** → выберите домен → **Настройки DNS**

**SPF (TXT):**
- Тип: `TXT`
- Имя: `@`
- Значение: `v=spf1 include:_spf.resend.com ~all`

**DKIM (CNAME):**
- Тип: `CNAME`
- Имя: `resend._domainkey`
- Значение: `resend._domainkey.resend.com`

**Важно:** Если у вас уже есть SPF запись для Яндекс.Почты, объедините их:
```
v=spf1 include:_spf.yandex.net include:_spf.resend.com ~all
```

## Beget

### Через панель управления:

1. **Домены** → выберите домен → **DNS-записи**

**SPF (TXT):**
- Тип: `TXT`
- Имя: `@`
- Значение: `v=spf1 include:_spf.resend.com ~all`
- TTL: 3600

**DKIM (CNAME):**
- Тип: `CNAME`
- Имя: `resend._domainkey`
- Значение: `resend._domainkey.resend.com`
- TTL: 3600

## DigitalOcean

### Через Networking → Domains:

1. **Networking** → **Domains** → выберите домен → **DNS Records**

**SPF (TXT):**
- Type: `TXT`
- Hostname: `@`
- Value: `v=spf1 include:_spf.resend.com ~all`
- TTL: 3600

**DKIM (CNAME):**
- Type: `CNAME`
- Hostname: `resend._domainkey`
- Value: `resend._domainkey.resend.com`
- TTL: 3600

## AWS Route 53

### Через консоль AWS:

1. **Route 53** → **Hosted zones** → выберите домен → **Create record**

**SPF (TXT):**
- Record name: `@` (или ваш домен)
- Record type: `TXT`
- Value: `v=spf1 include:_spf.resend.com ~all`
- TTL: 300

**DKIM (CNAME):**
- Record name: `resend._domainkey`
- Record type: `CNAME`
- Value: `resend._domainkey.resend.com`
- TTL: 300

## Важные замечания

1. **Имя записи:**
   - Для корневого домена может быть `@` или пустое поле
   - Для поддомена: `resend._domainkey` (без `.yourdomain.com`)

2. **Значение CNAME:**
   - Должно заканчиваться точкой в некоторых провайдерах
   - Проверьте точное значение в панели Resend

3. **TTL:**
   - Обычно 3600 секунд (1 час) или Auto
   - Можно оставить значение по умолчанию

4. **Время распространения:**
   - Обычно 5-30 минут
   - Может занять до 24 часов

## Проверка после добавления

Используйте онлайн-инструменты:

1. **MXToolbox:** https://mxtoolbox.com/SuperTool.aspx
   - Введите домен и выберите тип записи (TXT, CNAME)

2. **DNS Checker:** https://dnschecker.org/
   - Выберите тип записи и введите имя

3. **Через командную строку:**
   ```bash
   # Windows (PowerShell)
   nslookup -type=TXT yourdomain.com
   nslookup -type=CNAME resend._domainkey.yourdomain.com
   
   # Linux/Mac
   dig TXT yourdomain.com
   dig CNAME resend._domainkey.yourdomain.com
   ```

## Если что-то не работает

1. Убедитесь, что все записи добавлены правильно
2. Подождите 30-60 минут для распространения DNS
3. Проверьте записи через онлайн-инструменты
4. Убедитесь, что в панели Resend вы скопировали правильные значения
5. Если используете Cloudflare - убедитесь, что записи не проксируются (серый облачко)
