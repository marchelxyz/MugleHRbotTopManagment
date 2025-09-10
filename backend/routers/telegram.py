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
        # Обработка нажатия на inline-кнопку
        elif "callback_query" in data:
            callback_query = data["callback_query"]
            await answer_callback_query(callback_query["id"]) # Сразу убираем "часики"
            
            callback_data = callback_query["data"] # например "approve_10" ИЛИ "approve_update_5"
            admin_username = callback_query["from"].get("username", "Администратор")

            # --- НАЧАЛО ИЗМЕНЕНИЙ: Перестраиваем логику проверки ---

            # 1. ПРОВЕРЯЕМ НОВЫЙ КОЛБЭК ДЛЯ STATIX
            if callback_data.startswith("statix_sent_"):
                purchase_id = int(callback_data.split("_")[-1])
                
                # Вызываем нашу новую CRUD функцию
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

            # 2. ПРОВЕРЯЕМ КОЛБЭКИ ОБНОВЛЕНИЯ ПРОФИЛЯ (уже есть)
            elif callback_data.startswith("approve_update_") or callback_data.startswith("reject_update_"):
                # ... (существующая логика)

            # 3. ПРОВЕРЯЕМ КОЛБЭКИ РЕГИСТРАЦИИ (уже есть)
            elif callback_data.startswith("approve_") or callback_data.startswith("reject_"):
            
            # 1. СНАЧАЛА ПРОВЕРЯЕМ НОВЫЕ КОЛБЭКИ (Обновление профиля)
            if callback_data.startswith("approve_update_") or callback_data.startswith("reject_update_"):
                
                action_type = callback_data.split("_")[0] # "approve" или "reject"
                update_id = int(callback_data.split("_")[-1]) # id из таблицы PendingUpdate

                # Вызываем нашу новую CRUD функцию
                (user, status) = await crud.process_profile_update(db, update_id, action_type)
                
                if user and status == "approved":
                    await send_telegram_message(user.telegram_id, "✅ Администратор одобрил ваши изменения в профиле!")
                    await send_telegram_message(settings.TELEGRAM_CHAT_ID, f"✅ Изменения для @{user.username or user.first_name} одобрены адм. @{admin_username}.", 
                                                message_thread_id=settings.TELEGRAM_UPDATE_TOPIC_ID) # <-- Используем новую переменную
                    
                elif user and status == "rejected":
                    await send_telegram_message(user.telegram_id, "❌ Администратор отклонил ваши изменения в профиле.")
                    await send_telegram_message(settings.TELEGRAM_CHAT_ID, f"❌ Изменения для @{user.username or user.first_name} отклонены адм. @{admin_username}.", 
                                                message_thread_id=settings.TELEGRAM_UPDATE_TOPIC_ID) # <-- Используем новую переменную
                # Если status == None, значит запрос уже был обработан, ничего не делаем.

            # 2. ИНАЧЕ ПРОВЕРЯЕМ СТАРЫЕ КОЛБЭКИ (Регистрация)
            elif callback_data.startswith("approve_") or callback_data.startswith("reject_"):
                # --- Это СТАРАЯ ЛОГИКА (оставляем ее) ---
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
            
            # --- КОНЕЦ ИЗМЕНЕНИЙ ---

    except Exception as e:
        # ... (логирование ошибок)
        print(f"Error in telegram webhook: {e}")

    # В любом случае возвращаем Telegram "ok"
    return {"ok": True}
