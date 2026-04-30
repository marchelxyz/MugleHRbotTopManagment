-- Считаем существующих пользователей с реальным Telegram ID уже взаимодействовавшими с ботом.
-- По рабочей инструкции все пользователи нажимали /start, а более надёжная
-- проверка доставляемости теперь выполняется по фактическому ответу Telegram API
-- во время рассылки.
UPDATE users
SET has_interacted_with_bot = TRUE
WHERE telegram_id IS NOT NULL
  AND telegram_id >= 0
  AND COALESCE(has_interacted_with_bot, FALSE) = FALSE;
