# backend/routers/telegram.py
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
import crud
from database import get_db, settings
from bot import send_telegram_message, answer_callback_query

router = APIRouter()

@router.post("/telegram/webhook")
async def telegram_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    data = await request.json()

    if "callback_query" not in data:
        return {"ok": True}

    callback_query = data["callback_query"]
    callback_query_id = callback_query["id"]
    
    # --- НАЧАЛО ИЗМЕНЕНИЙ: Сразу отвечаем Telegram ---
    await answer_callback_query(callback_query_id)
    # --- КОНЕЦ ИЗМЕНЕНИЙ ---
    
    callback_data = callback_query["data"]
    user_id = int(callback_data.split("_")[1])
    action = callback_data.split("_")[0]

    user = await crud.get_user(db, user_id)
    if not user:
        return {"ok": False, "error": "User not found"}

    admin_username = callback_query["from"].get("username", "Администратор")
    
    if action == "approve":
        await crud.update_user_status(db, user_id, "approved")
        await send_telegram_message(user.telegram_id, "✅ Ваша заявка на регистрацию одобрена! Теперь вам доступны все функции.")
        await send_telegram_message(
            settings.TELEGRAM_CHAT_ID,
            f"✅ Авторизация @{user.username or user.first_name} одобрена администратором @{admin_username}!",
            message_thread_id=settings.TELEGRAM_ADMIN_TOPIC_ID
        )

    elif action == "reject":
        await crud.update_user_status(db, user_id, "rejected")
        await send_telegram_message(user.telegram_id, "❌ К сожалению, в регистрации было отказано.")
        await send_telegram_message(
            settings.TELEGRAM_CHAT_ID,
            f"❌ Авторизация @{user.username or user.first_name} отклонена администратором @{admin_username}!",
            message_thread_id=settings.TELEGRAM_ADMIN_TOPIC_ID
        )

    return {"ok": True}
