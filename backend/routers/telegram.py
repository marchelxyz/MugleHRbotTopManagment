import logging
import traceback
from typing import Any

import httpx
from fastapi import APIRouter, Request
from sqlalchemy.ext.asyncio import AsyncSession

import crud
from bot import (
    answer_callback_query,
    escape_html,
    send_telegram_message,
    safe_admin_notify,
)
from database import AsyncSessionLocal, settings

logger = logging.getLogger(__name__)

router = APIRouter()


async def safe_send_message(
    chat_id: int,
    text: str,
    reply_markup: dict | None = None,
    message_thread_id: int | None = None,
) -> None:
    """Отправляет сообщение в Telegram; ошибки только в лог (не роняет webhook).

    Для адресатов (личные сообщения / DM) ошибки не критичны — просто пишем лог.
    Для админ-чата (TELEGRAM_CHAT_ID) используется ``safe_admin_notify`` с
    автоматическим фолбэком, чтобы уведомления не пропадали из-за «protected»
    тредов или сбоев HTML-парсинга.
    """
    if chat_id == settings.TELEGRAM_CHAT_ID:
        await safe_admin_notify(
            chat_id=chat_id,
            text=text,
            reply_markup=reply_markup,
            message_thread_id=message_thread_id,
        )
        return
    try:
        await send_telegram_message(chat_id, text, reply_markup, message_thread_id)
    except Exception as e:
        logger.error(
            "safe_send_message: chat_id=%s thread=%s err=%s",
            chat_id,
            message_thread_id,
            e,
            exc_info=True,
        )


@router.get("/telegram/test")
async def telegram_test() -> dict[str, str]:
    """Проверка маршрутизации без секретов. Не подтверждает setWebhook — см. deploy/set-telegram-webhook.sh info."""
    return {
        "status": "ok",
        "webhook_post_path": "/telegram/webhook",
        "hint_ru": (
            "Если при нажатии inline-кнопки в логах нет строки access «POST /telegram/webhook», "
            "Telegram шлёт обновления не на этот хост: выполните set с APP_PUBLIC_URL вашего Timeweb "
            "и проверьте getWebhookInfo (url и last_error_message)."
        ),
    }


@router.post("/telegram/webhook")
async def telegram_webhook(request: Request) -> dict[str, bool]:
    """Обрабатывает update от Telegram.

    Важно: не использовать ``Depends(get_db)`` на этом маршруте — FastAPI откроет
    сессию БД *до* тела обработчика, и при медленном Postgres (Timeweb) запрос
    зависнет до ``answerCallbackQuery``: кнопки в чате «крутятся», пока не таймаут.
    Сначала читаем JSON и отвечаем на callback, затем открываем сессию.
    """
    client = getattr(request.client, "host", None)
    try:
        data = await request.json()
    except Exception:
        logger.exception("telegram webhook: тело запроса не является JSON")
        return {"ok": True}

    logger.info(
        "telegram webhook: update_id=%s client=%s keys=%s",
        data.get("update_id"),
        client,
        list(data.keys()),
    )

    callback_block = data.get("callback_query")
    callback_answered = False
    if isinstance(callback_block, dict) and callback_block.get("id"):
        callback_answered = await answer_callback_query(callback_block["id"])
        if not callback_answered:
            logger.error(
                "answerCallbackQuery не прошёл — проверьте TELEGRAM_BOT_TOKEN и "
                "что getWebhookInfo.url указывает на этот хост (после смены домена "
                "выполните deploy/set-telegram-webhook.sh set)."
            )

    try:
        async with AsyncSessionLocal() as db:
            await _dispatch_telegram_webhook_body(db, data, callback_answered)
    except Exception:
        logger.exception("Ошибка в telegram webhook после открытия БД")

    return {"ok": True}


async def _dispatch_telegram_webhook_body(
    db: AsyncSession,
    data: dict[str, Any],
    callback_answered: bool,
) -> None:
    """Разбор update: сообщения, документы, inline-кнопки (БД уже доступна)."""
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
                        "👋 Добро пожаловать! Теперь вы можете использовать приложение.",
                    )
                    await crud._create_notification(
                        db,
                        user.id,
                        "system",
                        "Добро пожаловать!",
                        'Спасибо за регистрацию в системе "Спасибо".',
                    )
                    await db.commit()

    if "message" in data and "document" in data["message"]:
        document = data["message"]["document"]
        user_tg_id = data["message"]["from"]["id"]

        if document.get("mime_type") == "application/vnd.apple.pkpass" or document.get(
            "file_name", ""
        ).endswith(".pkpass"):
            try:
                user = await crud.get_user_by_telegram(db, user_tg_id)
                if not user:
                    print(f"User not found for telegram_id: {user_tg_id}")
                    await safe_send_message(
                        user_tg_id,
                        "❌ Пользователь не найден. Пожалуйста, зарегистрируйтесь в приложении.",
                    )
                    return

                if not user.has_interacted_with_bot:
                    await crud.mark_user_interacted_with_bot(db, user.id)

                file_id = document["file_id"]
                print(f"Processing pkpass file for user {user.id}, file_id: {file_id}")

                timeout = httpx.Timeout(60.0, read=30.0)
                async with httpx.AsyncClient(timeout=timeout) as client:
                    file_path_res = await client.get(
                        f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/getFile?file_id={file_id}"
                    )
                    file_path_res.raise_for_status()
                    file_path_data = file_path_res.json()

                    if not file_path_data.get("ok") or "result" not in file_path_data:
                        print(f"Failed to get file path: {file_path_data}")
                        await safe_send_message(
                            user.telegram_id,
                            "❌ Ошибка при получении файла. Попробуйте отправить файл еще раз.",
                        )
                        return

                    file_path = file_path_data["result"]["file_path"]
                    print(f"File path retrieved: {file_path}")

                    file_url = f"https://api.telegram.org/file/bot{settings.TELEGRAM_BOT_TOKEN}/{file_path}"
                    file_res = await client.get(file_url)
                    file_res.raise_for_status()
                    file_content = file_res.content

                    if not file_content or len(file_content) == 0:
                        print("Empty file content received")
                        await safe_send_message(
                            user.telegram_id,
                            "❌ Файл пустой. Попробуйте отправить файл еще раз.",
                        )
                        return

                    print(f"File downloaded, size: {len(file_content)} bytes")

                    result = await crud.process_pkpass_file(db, user.id, file_content)
                    if result:
                        print(f"Pkpass file processed successfully for user {user.id}")
                        await safe_send_message(
                            user.telegram_id,
                            "✅ Ваша бонусная карта успешно добавлена в профиль!",
                        )
                        await crud._create_notification(
                            db,
                            user.id,
                            "system",
                            "Бонусная карта добавлена",
                            "Ваша бонусная карта успешно добавлена в профиль.",
                        )
                        await db.commit()
                    else:
                        print(f"Failed to process pkpass file for user {user.id}")
                        await safe_send_message(
                            user.telegram_id,
                            "❌ Ошибка при обработке файла. Убедитесь, что файл .pkpass корректен.",
                        )

            except httpx.ReadTimeout as e:
                print(f"Read timeout while processing pkpass file: {e}")
                print(traceback.format_exc())
                await safe_send_message(
                    user_tg_id,
                    "❌ Превышено время ожидания при загрузке файла. Файл может быть слишком большим или соединение медленное. Попробуйте отправить файл еще раз.",
                )
            except httpx.HTTPStatusError as e:
                print(f"HTTP error while processing pkpass file: {e}")
                print(f"Response: {e.response.text if hasattr(e, 'response') else 'N/A'}")
                await safe_send_message(
                    user_tg_id,
                    "❌ Ошибка при загрузке файла из Telegram. Попробуйте отправить файл еще раз.",
                )
            except ValueError as e:
                error_message = str(e)
                print(f"Validation error while processing pkpass file: {error_message}")
                await safe_send_message(user_tg_id, f"❌ {error_message}")
            except Exception as e:
                print(f"Error processing pkpass file: {e}")
                print(traceback.format_exc())
                await safe_send_message(
                    user_tg_id,
                    "❌ Произошла ошибка при обработке файла. Попробуйте позже или обратитесь в поддержку.",
                )

    if "callback_query" not in data:
        return

    callback_query = data["callback_query"]
    user_tg_id = callback_query["from"]["id"]
    user = await crud.get_user_by_telegram(db, user_tg_id)
    if user and not user.has_interacted_with_bot:
        await crud.mark_user_interacted_with_bot(db, user.id)

    callback_data = callback_query["data"]
    admin_username = callback_query["from"].get("username", "Администратор")
    logger.info(
        "telegram webhook callback from_id=%s data=%r answered_ok=%s",
        user_tg_id,
        callback_data,
        callback_answered,
    )

    if callback_data.startswith("approve_update_") or callback_data.startswith("reject_update_"):

        action_type = callback_data.split("_")[0]
        update_id = int(callback_data.split("_")[-1])

        (user, status) = await crud.process_profile_update(db, update_id, action_type)

        if user and status == "approved":
            if user.telegram_id and user.telegram_id >= 0:
                await safe_send_message(
                    user.telegram_id, "✅ Администратор одобрил ваши изменения в профиле!"
                )
            await safe_send_message(
                settings.TELEGRAM_CHAT_ID,
                f"✅ Изменения для @{escape_html(user.username or user.first_name or '')} одобрены адм. @{escape_html(admin_username)}.",
                message_thread_id=settings.TELEGRAM_UPDATE_TOPIC_ID,
            )
            await crud._create_notification(
                db,
                user.id,
                "profile",
                "Изменения профиля одобрены",
                "Ваши изменения в профиле были одобрены администратором.",
            )
            await db.commit()

        elif user and status == "rejected":
            if user.telegram_id and user.telegram_id >= 0:
                await safe_send_message(
                    user.telegram_id, "❌ Администратор отклонил ваши изменения в профиле."
                )
            await safe_send_message(
                settings.TELEGRAM_CHAT_ID,
                f"❌ Изменения для @{escape_html(user.username or user.first_name or '')} отклонены адм. @{escape_html(admin_username)}.",
                message_thread_id=settings.TELEGRAM_UPDATE_TOPIC_ID,
            )
            await crud._create_notification(
                db,
                user.id,
                "profile",
                "Изменения профиля отклонены",
                "Ваши изменения в профиле были отклонены администратором.",
            )
            await db.commit()

    elif callback_data.startswith("approve_local_purchase_") or callback_data.startswith(
        "reject_local_purchase_"
    ):
        local_purchase_id = int(callback_data.split("_")[-1])
        admin_telegram_id = callback_query["from"]["id"]

        admin_user = await crud.get_user_by_telegram(db, admin_telegram_id)
        if not admin_user or not admin_user.is_admin:
            await safe_send_message(
                admin_telegram_id, "❌ У вас нет прав для выполнения этого действия"
            )
            return

        action = "approve" if callback_data.startswith("approve_local_purchase_") else "reject"
        try:
            result = await crud.process_local_gift_approval(db, local_purchase_id, action)
            if result:
                action_text = "одобрена" if action == "approve" else "отклонена"
                await safe_send_message(
                    settings.TELEGRAM_CHAT_ID,
                    f"✅ Локальный подарок #{local_purchase_id} {action_text} администратором @{escape_html(admin_username)}",
                    message_thread_id=settings.TELEGRAM_PURCHASE_TOPIC_ID,
                )
        except ValueError as e:
            await safe_send_message(admin_telegram_id, f"❌ {str(e)}")

    elif callback_data.startswith("accept_shared_gift_") or callback_data.startswith(
        "reject_shared_gift_"
    ):
        invitation_id = int(callback_data.split("_")[-1])
        user_telegram_id = callback_query["from"]["id"]

        user = await crud.get_user_by_telegram(db, user_telegram_id)
        if not user:
            await safe_send_message(user_telegram_id, "❌ Пользователь не найден")
            return

        if callback_data.startswith("accept_shared_gift_"):
            try:
                result = await crud.accept_shared_gift_invitation(db, invitation_id, user.id)
                await safe_send_message(user_telegram_id, result["message"])
            except ValueError as e:
                await safe_send_message(user_telegram_id, f"❌ {str(e)}")
        else:
            try:
                result = await crud.reject_shared_gift_invitation(db, invitation_id, user.id)
                await safe_send_message(user_telegram_id, result["message"])
            except ValueError as e:
                await safe_send_message(user_telegram_id, f"❌ {str(e)}")

    elif callback_data.startswith("approve_") or callback_data.startswith("reject_"):
        user_id = int(callback_data.split("_")[1])
        action = callback_data.split("_")[0]

        pending = await crud.get_user(db, user_id)
        if not pending:
            logger.warning(
                "Регистрация callback: пользователь user_id=%s не найден",
                user_id,
            )
            return

        if action == "approve":
            updated = await crud.update_user_status(db, user_id, "approved")
            if not updated:
                logger.error(
                    "update_user_status(approved) вернул None для user_id=%s",
                    user_id,
                )
                return
            display = escape_html(updated.username or updated.first_name or "user")
            await safe_send_message(
                settings.TELEGRAM_CHAT_ID,
                f"✅ Авторизация @{display} одобрена администратором @{escape_html(admin_username)}!",
                message_thread_id=settings.TELEGRAM_ADMIN_TOPIC_ID,
            )
            await crud._create_notification(
                db,
                updated.id,
                "system",
                "Регистрация одобрена",
                "Ваша заявка на регистрацию одобрена! Добро пожаловать.",
            )
            await db.commit()

        elif action == "reject":
            tg_target = pending.telegram_id
            updated = await crud.update_user_status(db, user_id, "rejected")
            if not updated:
                logger.error(
                    "update_user_status(rejected) вернул None для user_id=%s",
                    user_id,
                )
                return
            if tg_target is not None and tg_target >= 0:
                await safe_send_message(tg_target, "❌ В регистрации отказано.")
            display = escape_html(updated.username or updated.first_name or "user")
            await safe_send_message(
                settings.TELEGRAM_CHAT_ID,
                f"❌ Авторизация @{display} отклонена администратором @{escape_html(admin_username)}!",
                message_thread_id=settings.TELEGRAM_ADMIN_TOPIC_ID,
            )
            await crud._create_notification(
                db,
                updated.id,
                "system",
                "Регистрация отклонена",
                "В регистрации отказано.",
            )
            await db.commit()
