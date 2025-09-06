# backend/routers/telegram.py
from fastapi import APIRouter, Depends, Request
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
import crud, models, schemas
from database import get_db, settings
from bot import send_telegram_message, answer_callback_query

router = APIRouter()

@router.get("/telegram/test")
async def telegram_test():
    print("--- DEBUG: TEST ENDPOINT WAS CALLED SUCCESSFULLY! ---")
    return {"status": "ok"}

# --- ИСПРАВЛЕНИЕ: Оборачиваем всю функцию в правильный try/except ---
@router.post("/telegram/webhook")
async def telegram_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        data = await request.json()

        # Обработка отправленного файла .pkpass
        if "message" in data and "document" in data["message"]:
            document = data["message"]["document"]
            user_tg_id = data["message"]["from"]["id"]
            
            if document.get("mime_type") == "application/vnd.apple.pkpass" or document.get("file_name", "").endswith(".pkpass"):
                user = await crud.get_user_by_telegram(db, user_tg_id)
                if user:
                    file_id = document["file_id"]
                    async with httpx.AsyncClient() as client:
                        file_path_res = await client.get(f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getFile?file_id={file_id}")
                        file_path = file_path_res.json()["result"]["file_path"]
                        
                        file_url = f"https://api.telegram.org/file/bot{settings.TELEGRAM_BOT_TOKEN}/{file_path}"
                        file_res = await client.get(file_url)
                        file_content = file_res.content
                        
                        await crud.process_pkpass_file(db, user.id, file_content)
                        await send_telegram_message(user.telegram_id, "✅ Ваша бонусная карта успешно добавлена в профиль!")

        # Обработка нажатия на inline-кнопку
        elif "callback_query" in data:
            callback_query = data["callback_query"]
            await answer_callback_query(callback_query["id"])
            
            callback_data = callback_query["data"]
            user_id = int(callback_data.split("_")[1])
            action = callback_data.split("_")[0]

            user = await crud.get_user(db, user_id)
            if not user: return {"ok": False, "error": "User not found"}

            admin_username = callback_query["from"].get("username", "Администратор")
            
            if action == "approve":
                await crud.update_user_status(db, user_id, "approved")
                await send_telegram_message(user.telegram_id, "✅ Ваша заявка на регистрацию одобрена!")
                await send_telegram_message(settings.TELEGRAM_CHAT_ID, f"✅ Авторизация @{user.username or user.first_name} одобрена администратором @{admin_username}!", message_thread_id=settings.TELEGRAM_ADMIN_TOPIC_ID)

            elif action == "reject":
                await crud.update_user_status(db, user_id, "rejected")
                await send_telegram_message(user.telegram_id, "❌ В регистрации отказано.")
                await send_telegram_message(settings.TELEGRAM_CHAT_ID, f"❌ Авторизация @{user.username or user.first_name} отклонена администратором @{admin_username}!", message_thread_id=settings.TELEGRAM_ADMIN_TOPIC_ID)

    except Exception as e:
        # Логируем любую ошибку, которая могла произойти
        print(f"Error in telegram webhook: {e}")

    # В любом случае возвращаем Telegram "ok", чтобы он не пытался отправить запрос повторно
    return {"ok": True}
