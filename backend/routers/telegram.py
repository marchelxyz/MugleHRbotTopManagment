# backend/routers/telegram.py
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
import crud
from database import get_db, settings
from bot import send_telegram_message, answer_callback_query
import json # Добавляем импорт json

router = APIRouter()

@router.get("/telegram/test")
async def telegram_test():
    """Простой эндпоинт для проверки доступности сервера."""
    print("--- DEBUG: TEST ENDPOINT WAS CALLED SUCCESSFULLY! ---")
    return {"status": "ok"}

@router.post("/telegram/webhook")
async def telegram_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    # --- НАЧАЛО ДИАГНОСТИКИ ---
    print("--- DEBUG: Webhook received a request! ---")
    try:
        data = await request.json()
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
