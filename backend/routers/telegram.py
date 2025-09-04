# backend/routers/telegram.py
from fastapi import APIRouter, Depends, Request
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
import crud
from database import get_db, settings
from bot import send_telegram_message, answer_callback_query
import json # Добавляем импорт json

router = APIRouter()

# --- ВОТ ЭТОТ КОД ---
@router.get("/telegram/test")
async def telegram_test():
    print("--- DEBUG: TEST ENDPOINT WAS CALLED SUCCESSFULLY! ---")
    return {"status": "ok"}
# -------------------

@router.post("/telegram/webhook")
async def telegram_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    # --- НАЧАЛО ДИАГНОСТИКИ ---
    print("--- DEBUG: Webhook received a request! ---")
    try:
        data = await request.json()

    # --- НАЧАЛО ИЗМЕНЕНИЙ: Обработка отправленного файла ---
    if "message" in data and "document" in data["message"]:
        document = data["message"]["document"]
        user_tg_id = data["message"]["from"]["id"]
        
        # Проверяем, что это pkpass файл
        if document.get("mime_type") == "application/vnd.apple.pkpass" or document.get("file_name", "").endswith(".pkpass"):
            user = await crud.get_user_by_telegram(db, user_tg_id)
            if user:
                file_id = document["file_id"]
                # Получаем путь к файлу
                async with httpx.AsyncClient() as client:
                    file_path_res = await client.get(f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getFile?file_id={file_id}")
                    file_path = file_path_res.json()["result"]["file_path"]
                    
                    # Скачиваем файл
                    file_url = f"https://api.telegram.org/file/bot{settings.TELEGRAM_BOT_TOKEN}/{file_path}"
                    file_res = await client.get(file_url)
                    file_content = file_res.content
                    
                    # Обрабатываем и сохраняем
                    await crud.process_pkpass_file(db, user.id, file_content)
                    await send_telegram_message(user.telegram_id, "✅ Ваша бонусная карта успешно добавлена в профиль!")
            return {"ok": True}
    # --- КОНЕЦ ИЗМЕНЕНИЙ ---
        
        print(f"--- DEBUG: Request Body: {json.dumps(data, indent=2)} ---")
    except Exception as e:
        print(f"--- DEBUG: Could not parse request JSON. Error: {e} ---")
        return {"ok": False}

    if "callback_query" not in data:
        print("--- DEBUG: Request is not a callback query. Ignoring. ---")
        return {"ok": True}
    
    print("--- DEBUG: Processing callback query... ---")
    callback_query = data["callback_query"]
    callback_query_id = callback_query["id"]
    
    try:
        await answer_callback_query(callback_query_id)
        print(f"--- DEBUG: Successfully answered callback query {callback_query_id} ---")
    except Exception as e:
        print(f"--- DEBUG: FAILED to answer callback query. Error: {e} ---")

    callback_data = callback_query["data"]
    admin_username = callback_query["from"].get("username", "Администратор")
    
    print(f"--- DEBUG: Callback data received: {callback_data} ---")
    
    try:
        action, user_id_str = callback_data.split("_")
        user_id = int(user_id_str)
        print(f"--- DEBUG: Parsed action: '{action}', user_id: {user_id} ---")
    except Exception as e:
        print(f"--- DEBUG: FAILED to parse callback_data '{callback_data}'. Error: {e} ---")
        return {"ok": False}

    user = await crud.get_user(db, user_id)
    if not user:
        print(f"--- DEBUG: User with id {user_id} not found in DB. ---")
        return {"ok": False, "error": "User not found"}

    print(f"--- DEBUG: User {user.username or user.first_name} found. Processing action '{action}'. ---")
    
    if action == "approve":
        await crud.update_user_status(db, user_id, "approved")
        print(f"--- DEBUG: User {user_id} status updated to 'approved'. ---")
        await send_telegram_message(user.telegram_id, "✅ Ваша заявка на регистрацию одобрена! Теперь вам доступны все функции.")
        await send_telegram_message(
            settings.TELEGRAM_CHAT_ID,
            f"✅ Авторизация @{user.username or user.first_name} одобрена администратором @{admin_username}!",
            message_thread_id=settings.TELEGRAM_ADMIN_TOPIC_ID
        )
        print("--- DEBUG: Approval notifications sent. ---")

    elif action == "reject":
        await crud.update_user_status(db, user_id, "rejected")
        print(f"--- DEBUG: User {user_id} status updated to 'rejected'. ---")
        await send_telegram_message(user.telegram_id, "❌ К сожалению, в регистрации было отказано.")
        await send_telegram_message(
            settings.TELEGRAM_CHAT_ID,
            f"❌ Авторизация @{user.username or user.first_name} отклонена администратором @{admin_username}!",
            message_thread_id=settings.TELEGRAM_ADMIN_TOPIC_ID
        )
        print("--- DEBUG: Rejection notifications sent. ---")

    print("--- DEBUG: Webhook processing finished successfully. ---")
    return {"ok": True}
