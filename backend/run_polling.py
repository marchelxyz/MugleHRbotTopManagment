import httpx
import asyncio
import os

# Получаем переменные окружения
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

# --- ИЗМЕНЕНИЕ: Получаем URL из переменной окружения ---
# Если переменная не задана, по умолчанию используется localhost (для локальной разработки)
WEBHOOK_URL = os.getenv("INTERNAL_WEBHOOK_URL", "http://localhost:8080/telegram/webhook")

TELEGRAM_API_URL = f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates"

async def main():
    print("--- Starting Telegram Polling Script ---")
    print(f"--- Forwarding updates to: {WEBHOOK_URL} ---") # Добавляем лог для проверки
    update_offset = 0
    
    async with httpx.AsyncClient(timeout=40) as client:
        while True:
            try:
                # ... (остальной код цикла без изменений) ...
                response = await client.get(
                    TELEGRAM_API_URL,
                    params={'offset': update_offset, 'timeout': 30}
                )
                response.raise_for_status()
                updates = response.json()

                if updates["result"]:
                    for update in updates["result"]:
                        update_offset = update["update_id"] + 1
                        
                        print(f"--- Polling: Received update {update['update_id']}. Forwarding to webhook. ---")
                        
                        # Пересылаем обновление на наш основной обработчик
                        await client.post(WEBHOOK_URL, json=update)

            except httpx.ConnectError as e:
                # --- ИЗМЕНЕНИЕ: Добавляем более конкретную обработку ошибки ---
                print(f"--- POLLING CONNECT ERROR: Could not connect to {WEBHOOK_URL}. Is the main server running? Error: {e} ---")
                print("--- Retrying in 10 seconds. ---")
                await asyncio.sleep(10)
            except Exception as e:
                print(f"--- Polling Error: {e}. Retrying in 10 seconds. ---")
                await asyncio.sleep(10)

if __name__ == "__main__":
    asyncio.run(main())
