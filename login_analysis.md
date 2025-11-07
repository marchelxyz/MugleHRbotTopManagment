# Анализ логов: заходы в приложение

## Заход #1: Новый пользователь (создание сессии)
**Время:** 2025-11-07 09:52:57

1. **Поиск пользователя по Telegram ID:**
   - `09:52:57,609` - Запрос пользователя с `telegram_id = 727331113`
   - SQL: `SELECT users.id, ... FROM users WHERE users.telegram_id = $1::BIGINT AND users.telegram_id != $2::BIGINT`
   - Параметры: `(727331113, -1)`

2. **Создание новой сессии:**
   - `09:52:57,614` - INSERT новой сессии в `user_sessions`
   - SQL: `INSERT INTO user_sessions (user_id, session_start, last_seen) VALUES ($1::INTEGER, now(), now())`
   - Параметры: `user_id = 1`
   - Результат: создана сессия с `id = 458`

3. **Получение информации о созданной сессии:**
   - `09:52:57,622` - SELECT сессии по `id = 458`
   - SQL: `SELECT user_sessions.id, user_sessions.user_id, user_sessions.session_start, user_sessions.last_seen FROM user_sessions WHERE user_sessions.id = $1::INTEGER`

**Итог:** Пользователь с `telegram_id = 727331113` (user_id = 1) вошел в приложение, создана новая сессия (id = 458)

---

## Заход #2: Существующий пользователь (обновление сессии)
**Время:** 2025-11-07 09:54:53

1. **Поиск пользователя по Telegram ID:**
   - `09:54:53,614` - Запрос пользователя с `telegram_id = 453483813`
   - SQL: `SELECT users.id, ... FROM users WHERE users.telegram_id = $1::BIGINT AND users.telegram_id != $2::BIGINT`
   - Параметры: `(453483813, -1)`

2. **Получение существующей сессии:**
   - `09:54:53,617` - SELECT сессии по `id = 456`
   - SQL: `SELECT user_sessions.id, user_sessions.user_id, user_sessions.session_start, user_sessions.last_seen FROM user_sessions WHERE user_sessions.id = $1::INTEGER`

3. **Обновление времени последнего визита:**
   - `09:54:53,619` - UPDATE сессии, обновление `last_seen`
   - SQL: `UPDATE user_sessions SET last_seen=$1::TIMESTAMP WITHOUT TIME ZONE WHERE user_sessions.id = $2::INTEGER`
   - Параметры: `(datetime.datetime(2025, 11, 7, 9, 54, 53, 619136), 456)`
   - Коммит: `09:54:53,620` - COMMIT

**Итог:** Пользователь с `telegram_id = 453483813` вошел в приложение, обновлена существующая сессия (id = 456), время последнего визита установлено на `2025-11-07 09:54:53`

---

## Резюме

В логах найдено **2 захода в приложение**:

1. **09:52:57** - Пользователь `telegram_id = 727331113` (user_id = 1) - **создана новая сессия** (id = 458)
2. **09:54:53** - Пользователь `telegram_id = 453483813` - **обновлена существующая сессия** (id = 456)

Оба захода используют механизм сессий через таблицу `user_sessions`, где отслеживается `session_start` и `last_seen`.
