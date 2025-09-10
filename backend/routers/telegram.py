# backend/routers/telegram.py
from fastapi import APIRouter, Depends, Request
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
import crud, models, schemas
from database import get_db, settings
# ДОБАВЛЕН НЕДОСТАЮЩИЙ ИМПОРТ
from bot import send_telegram_message, answer_callback_query, edit_telegram_message 

router = APIRouter()

@router.get("/telegram/test")
async def telegram_test():
    print("--- DEBUG: TEST ENDPOINT WAS CALLED SUCCESSFULLY! ---")
    return {"status": "ok"}

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
            await answer_callback_query(callback_query["id"]) # Сразу убираем "часики"
            
            callback_data = callback_query["data"] # например "approve_10" ИЛИ "approve_update_5"
            admin_username = callback_query["from"].get("username", "Администратор")

            # ================= НАЧАЛО ИСПРАВЛЕННОГО БЛОКА ЛОГИКИ =================
            
            # Шаг 1: Проверяем самый уникальный колбэк для Statix
            if callback_data.startswith("statix_sent_"):
                purchase_id = int(callback_data.split("_")[-1])
                
                purchase = await crud.fulfill_statix_purchase(db, purchase_id)
                
                if purchase:
                    # Уведомляем пользователя
                    user_message = f"✅ Ваши *{purchase.item.name}* (x{purchase.quantity}) были отправлены на вашу карту!"
                    await send_telegram_message(purchase.user.telegram_id, user_message)
                    
                    # Редактируем сообщение в админ-чате
                    original_message = callback_query["message"]["text"]
                    new_admin_text = f"{original_message}\n\n*✅ Выполнено администратором @{admin_username}*"
                    await edit_telegram_message(
                        chat_id=callback_query["message"]["chat"]["id"],
                        message_id=callback_query["message"]["message_id"],
                        text=new_admin_text
                    )

            # Шаг 2: Проверяем более конкретный колбэк для обновления профиля
            elif callback_data.startswith("approve_update_") or callback_data.startswith("reject_update_"):
                action_type = callback_data.split("_")[0] # "approve" или "reject"
                update_id = int(callback_data.split("_")[-1]) # id из таблицы PendingUpdate

                (user, status) = await crud.process_profile_update(db, update_id, action_type)
                
                if user and status == "approved":
                    await send_telegram_message(user.telegram_id, "✅ Администратор одобрил ваши изменения в профиле!")
                    await send_telegram_message(settings.TELEGRAM_CHAT_ID, f"✅ Изменения для @{user.username or user.first_name} одобрены адм. @{admin_username}.", 
                                                  message_thread_id=settings.TELEGRAM_UPDATE_TOPIC_ID)
                
                elif user and status == "rejected":
                    await send_telegram_message(user.telegram_id, "❌ Администратор отклонил ваши изменения в профиле.")
                    await send_telegram_message(settings.TELEGRAM_CHAT_ID, f"❌ Изменения для @{user.username or user.first_name} отклонены адм. @{admin_username}.", 
                                                  message_thread_id=settings.TELEGRAM_UPDATE_TOPIC_ID)
                # Если status == None, значит запрос уже был обработан, ничего не делаем.

            # Шаг 3: Проверяем самый общий колбэк для регистрации (ОН ДОЛЖЕН БЫТЬ ПОСЛЕДНИМ)
            elif callback_data.startswith("approve_") or callback_data.startswith("reject_"):
                user_id = int(callback_data.split("_")[1])
                action = callback_data.split("_")[0]

                user = await crud.get_user(db, user_id)
                if not user: return {"ok": False, "error": "User not found"}
            
                if action == "approve":
                    await crud.update_user_status(db, user_id, "approved")
                    await send_telegram_message(user.telegram_id, "✅ Ваша заявка на регистрацию одобрена!")
                    await send_telegram_message(settings.TELEGRAM_CHAT_ID, f"✅ Авторизация @{user.username or user.first_name} одобрена администратором @{admin_username}!", message_thread_id=settings.TELEGRAM_ADMIN_TOPIC_ID)

                elif action == "reject":
                    await crud.update_user_status(db, user_id, "rejected")
                    await send_telegram_message(user.telegram_id, "❌ В регистрации отказано.")
                    await send_telegram_message(settings.TELEGRAM_CHAT_ID, f"❌ Авторизация @{user.username or user.first_name} отклонена администратором @{admin_username}!", message_thread_id=settings.TELEGRAM_ADMIN_TOPIC_ID)
            
            # ================= КОНЕЦ ИСПРАВЛЕННОГО БЛОКА ЛОГИКИ =================

    except Exception as e:
        # Важно логировать ошибки, чтобы понимать, что пошло не так
        print(f"!!! CRITICAL Error in telegram webhook: {e}")
        # Можно также добавить отправку уведомления об ошибке администратору
        # await send_telegram_message(YOUR_ADMIN_ID, f"Webhook Error: {e}")

    # В любом случае возвращаем Telegram "ok", чтобы он не пытался повторить запрос
    return {"ok": True}
