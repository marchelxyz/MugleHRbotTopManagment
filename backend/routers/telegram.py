from fastapi import APIRouter, Depends, Request
import httpx
import traceback
from sqlalchemy.ext.asyncio import AsyncSession
import crud, models, schemas
from database import get_db, settings
from bot import send_telegram_message, answer_callback_query, escape_html

router = APIRouter()

async def safe_send_message(chat_id: int, text: str, reply_markup: dict = None, message_thread_id: int = None):
    """Безопасно отправляет сообщение, обрабатывая ошибки"""
    try:
        await send_telegram_message(chat_id, text, reply_markup, message_thread_id)
    except Exception as e:
        print(f"Failed to send message to {chat_id}: {e}")
        print(traceback.format_exc())

@router.get("/telegram/test")
async def telegram_test():
    print("--- DEBUG: TEST ENDPOINT WAS CALLED SUCCESSFULLY! ---")
    return {"status": "ok"}

@router.post("/telegram/webhook")
async def telegram_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        data = await request.json()

        if "message" in data and "text" in data["message"]:
            message = data["message"]
            user_tg_id = message["from"]["id"]
            text = message.get("text", "").strip()
            
            if text:
                user = await crud.get_user_by_telegram(db, user_tg_id)
                if user and not user.has_interacted_with_bot:
                    await crud.mark_user_interacted_with_bot(db, user.id)
                    if text.startswith("/start"):
                        await safe_send_message(
                            user_tg_id,
                            "👋 Добро пожаловать! Теперь вы можете использовать приложение."
                        )

        if "message" in data and "document" in data["message"]:
            document = data["message"]["document"]
            user_tg_id = data["message"]["from"]["id"]
            
            if document.get("mime_type") == "application/vnd.apple.pkpass" or document.get("file_name", "").endswith(".pkpass"):
                try:
                    user = await crud.get_user_by_telegram(db, user_tg_id)
                    if not user:
                        print(f"User not found for telegram_id: {user_tg_id}")
                        await safe_send_message(user_tg_id, "❌ Пользователь не найден. Пожалуйста, зарегистрируйтесь в приложении.")
                        return {"ok": True}
                    
                    if not user.has_interacted_with_bot:
                        await crud.mark_user_interacted_with_bot(db, user.id)
                    
                    file_id = document["file_id"]
                    print(f"Processing pkpass file for user {user.id}, file_id: {file_id}")
                    
                    timeout = httpx.Timeout(60.0, read=30.0)
                    async with httpx.AsyncClient(timeout=timeout) as client:
                        file_path_res = await client.get(f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getFile?file_id={file_id}")
                        file_path_res.raise_for_status()
                        file_path_data = file_path_res.json()
                        
                        if not file_path_data.get("ok") or "result" not in file_path_data:
                            print(f"Failed to get file path: {file_path_data}")
                            await safe_send_message(user.telegram_id, "❌ Ошибка при получении файла. Попробуйте отправить файл еще раз.")
                            return {"ok": True}
                        
                        file_path = file_path_data["result"]["file_path"]
                        print(f"File path retrieved: {file_path}")
                        
                        file_url = f"https://api.telegram.org/file/bot{settings.TELEGRAM_BOT_TOKEN}/{file_path}"
                        file_res = await client.get(file_url)
                        file_res.raise_for_status()
                        file_content = file_res.content
                        
                        if not file_content or len(file_content) == 0:
                            print(f"Empty file content received")
                            await safe_send_message(user.telegram_id, "❌ Файл пустой. Попробуйте отправить файл еще раз.")
                            return {"ok": True}
                        
                        print(f"File downloaded, size: {len(file_content)} bytes")
                        
                        result = await crud.process_pkpass_file(db, user.id, file_content)
                        if result:
                            print(f"Pkpass file processed successfully for user {user.id}")
                            await safe_send_message(user.telegram_id, "✅ Ваша бонусная карта успешно добавлена в профиль!")
                        else:
                            print(f"Failed to process pkpass file for user {user.id}")
                            await safe_send_message(user.telegram_id, "❌ Ошибка при обработке файла. Убедитесь, что файл .pkpass корректен.")
                            
                except httpx.ReadTimeout as e:
                    print(f"Read timeout while processing pkpass file: {e}")
                    print(traceback.format_exc())
                    await safe_send_message(user_tg_id, "❌ Превышено время ожидания при загрузке файла. Файл может быть слишком большим или соединение медленное. Попробуйте отправить файл еще раз.")
                except httpx.HTTPStatusError as e:
                    print(f"HTTP error while processing pkpass file: {e}")
                    print(f"Response: {e.response.text if hasattr(e, 'response') else 'N/A'}")
                    await safe_send_message(user_tg_id, "❌ Ошибка при загрузке файла из Telegram. Попробуйте отправить файл еще раз.")
                except ValueError as e:
                    error_message = str(e)
                    print(f"Validation error while processing pkpass file: {error_message}")
                    await safe_send_message(user_tg_id, f"❌ {error_message}")
                except Exception as e:
                    print(f"Error processing pkpass file: {e}")
                    print(traceback.format_exc())
                    await safe_send_message(user_tg_id, "❌ Произошла ошибка при обработке файла. Попробуйте позже или обратитесь в поддержку.")

        elif "callback_query" in data:
            callback_query = data["callback_query"]
            await answer_callback_query(callback_query["id"])
            
            user_tg_id = callback_query["from"]["id"]
            user = await crud.get_user_by_telegram(db, user_tg_id)
            if user and not user.has_interacted_with_bot:
                await crud.mark_user_interacted_with_bot(db, user.id)
            
            callback_data = callback_query["data"]
            admin_username = callback_query["from"].get("username", "Администратор")

            if callback_data.startswith("approve_update_") or callback_data.startswith("reject_update_"):
                
                action_type = callback_data.split("_")[0]
                update_id = int(callback_data.split("_")[-1])

                (user, status) = await crud.process_profile_update(db, update_id, action_type)
                
                if user and status == "approved":
                    if user.telegram_id and user.telegram_id >= 0:
                        await safe_send_message(user.telegram_id, "✅ Администратор одобрил ваши изменения в профиле!")
                    await safe_send_message(settings.TELEGRAM_CHAT_ID, f"✅ Изменения для @{escape_html(user.username or user.first_name or '')} одобрены адм. @{escape_html(admin_username)}.", 
                                                message_thread_id=settings.TELEGRAM_UPDATE_TOPIC_ID)
                    
                elif user and status == "rejected":
                    if user.telegram_id and user.telegram_id >= 0:
                        await safe_send_message(user.telegram_id, "❌ Администратор отклонил ваши изменения в профиле.")
                    await safe_send_message(settings.TELEGRAM_CHAT_ID, f"❌ Изменения для @{escape_html(user.username or user.first_name or '')} отклонены адм. @{escape_html(admin_username)}.", 
                                                message_thread_id=settings.TELEGRAM_UPDATE_TOPIC_ID)

            elif callback_data.startswith("approve_local_purchase_") or callback_data.startswith("reject_local_purchase_"):
                local_purchase_id = int(callback_data.split("_")[-1])
                admin_telegram_id = callback_query["from"]["id"]
                
                admin_user = await crud.get_user_by_telegram(db, admin_telegram_id)
                if not admin_user or not admin_user.is_admin:
                    await safe_send_message(admin_telegram_id, "❌ У вас нет прав для выполнения этого действия")
                    return {"ok": False, "error": "Not an admin"}
                
                action = "approve" if callback_data.startswith("approve_local_purchase_") else "reject"
                try:
                    result = await crud.process_local_gift_approval(db, local_purchase_id, action)
                    if result:
                        action_text = "одобрена" if action == "approve" else "отклонена"
                        await safe_send_message(
                            settings.TELEGRAM_CHAT_ID,
                            f"✅ Локальный подарок #{local_purchase_id} {action_text} администратором @{escape_html(admin_username)}",
                            message_thread_id=settings.TELEGRAM_PURCHASE_TOPIC_ID
                        )
                except ValueError as e:
                        await safe_send_message(admin_telegram_id, f"❌ {str(e)}")
            
            elif callback_data.startswith("accept_shared_gift_") or callback_data.startswith("reject_shared_gift_"):
                invitation_id = int(callback_data.split("_")[-1])
                user_telegram_id = callback_query["from"]["id"]
                
                user = await crud.get_user_by_telegram(db, user_telegram_id)
                if not user:
                    await safe_send_message(user_telegram_id, "❌ Пользователь не найден")
                    return {"ok": False, "error": "User not found"}
                
                if callback_data.startswith("accept_shared_gift_"):
                    try:
                        result = await crud.accept_shared_gift_invitation(db, invitation_id, user.id)
                        await safe_send_message(user_telegram_id, result["message"])
                    except ValueError as e:
                        await safe_send_message(user_telegram_id, f"❌ {str(e)}")
                else:  # reject_shared_gift_
                    try:
                        result = await crud.reject_shared_gift_invitation(db, invitation_id, user.id)
                        await safe_send_message(user_telegram_id, result["message"])
                    except ValueError as e:
                        await safe_send_message(user_telegram_id, f"❌ {str(e)}")

            elif callback_data.startswith("approve_") or callback_data.startswith("reject_"):
                user_id = int(callback_data.split("_")[1])
                action = callback_data.split("_")[0]

                user = await crud.get_user(db, user_id)
                if not user: return {"ok": False, "error": "User not found"}
            
                if action == "approve":
                    await crud.update_user_status(db, user_id, "approved")
                    if user.telegram_id and user.telegram_id >= 0:
                        await safe_send_message(user.telegram_id, "✅ Ваша заявка на регистрацию одобрена!")
                    await safe_send_message(settings.TELEGRAM_CHAT_ID, f"✅ Авторизация @{escape_html(user.username or user.first_name or '')} одобрена администратором @{escape_html(admin_username)}!", message_thread_id=settings.TELEGRAM_ADMIN_TOPIC_ID)

                elif action == "reject":
                    await crud.update_user_status(db, user_id, "rejected")
                    if user.telegram_id and user.telegram_id >= 0:
                        await safe_send_message(user.telegram_id, "❌ В регистрации отказано.")
                    await safe_send_message(settings.TELEGRAM_CHAT_ID, f"❌ Авторизация @{escape_html(user.username or user.first_name or '')} отклонена администратором @{escape_html(admin_username)}!", message_thread_id=settings.TELEGRAM_ADMIN_TOPIC_ID)

    except Exception as e:
        print(f"Error in telegram webhook: {e}")
        print(traceback.format_exc())

    return {"ok": True}
