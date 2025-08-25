import httpx
import asyncio
import os

# Получаем переменные окружения
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
# URL нашего локального веб-сервера, который запущен на том же хостинге
WEBHOOK_URL = "http://localhost:8080/telegram/webhook"
# URL для запроса обновлений от Telegram
TELEGRAM_API_URL = f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates"

async def main():
    print("--- Starting Telegram Polling Script ---")
    update_offset = 0
    
    async with httpx.AsyncClient(timeout=40) as client:
        while True:
            try:
                # Отправляем запрос с длинным ожиданием (30 секунд)
                response = await client.get(
                    TELEGRAM_API_URL,
                    params={'offset': update_offset, 'timeout': 30}
                )
                response.raise_for_status()
                updates = response.json()

                if updates["result"]:
                    for update in updates["result"]:
                        # Получаем ID обновления, чтобы не запрашивать его снова
                        update_offset = update["update_id"] + 1
                        
                        print(f"--- Polling: Received update {update['update_id']}. Forwarding to webhook. ---")
                        
                        # Пересылаем обновление на наш основной обработчик,
                        # как будто оно пришло через вебхук
                        await client.post(WEBHOOK_URL, json=update)

            except httpx.ReadTimeout:
                # Это нормальная ситуация, просто продолжаем
                continue
            except Exception as e:
                print(f"--- Polling Error: {e}. Retrying in 10 seconds. ---")
                await asyncio.sleep(10)

if __name__ == "__main__":
    asyncio.run(main())
