# backend/routers/admin.py

from fastapi import APIRouter, Depends, HTTPException, Response, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError # <-- ДОБАВЬ ЭТУ СТРОКУ
from typing import List, Optional
from datetime import date, datetime, timedelta  # <--- ИСПРАВЛЕНИЕ ЗДЕСЬ
import crud
import schemas
import models
import io
from fastapi.responses import StreamingResponse
from dependencies import get_current_admin_user
from database import get_db
from openpyxl import Workbook
import pandas as pd  # <--- ДОБАВЬ ЭТУ СТРОКУ
import pytz # <-- 1. Добавляем новый импорт

# --- ПРАВИЛЬНАЯ НАСТРОЙКА РОУТЕРА ---
# Префикс /admin и зависимость от админа задаются один раз здесь
router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(get_current_admin_user)]
)

class AddPointsRequest(BaseModel):
    amount: int
class AddTicketsRequest(BaseModel):
    amount: int

# --- Эндпоинты управления ---

@router.post("/add-points")
async def add_points(request: AddPointsRequest, db: AsyncSession = Depends(get_db)):
    await crud.add_points_to_all_users(db, amount=request.amount)
    return {"detail": f"Successfully added {request.amount} points to all users"}

@router.post("/add-tickets")
async def add_tickets(request: AddTicketsRequest, db: AsyncSession = Depends(get_db)):
    await crud.add_tickets_to_all_users(db, amount=request.amount)
    return {"detail": f"Successfully added {request.amount} tickets to all users"}

@router.post("/market-items", response_model=schemas.MarketItemResponse)
async def create_new_market_item(
    item: schemas.MarketItemCreate, 
    db: AsyncSession = Depends(get_db),
    # Я добавил зависимость от админа, чтобы защитить этот эндпоинт
    current_user: models.User = Depends(get_current_admin_user)
):
    try:
        new_item = await crud.admin_create_market_item(db=db, item=item)
        # Возвращаем ответ так, чтобы он соответствовал схеме
        return new_item
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Один или несколько из предоставленных кодов уже существуют. Убедитесь, что все коды уникальны."
        )

@router.put("/market-items/{item_id}", response_model=schemas.MarketItemResponse)
async def update_market_item_route(
    item_id: int,
    item_data: schemas.MarketItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user)
):
    # --- НАЧАЛО ЛОГОВ ---
    print(f"--- [ROUTER UPDATE {item_id}] Получен PUT запрос ---")
    print(f"--- [ROUTER UPDATE {item_id}] Данные от фронтенда: {item_data.model_dump(exclude_unset=True)}")
    # --- КОНЕЦ ЛОГОВ ---
    try:
        updated_item = await crud.admin_update_market_item(db, item_id, item_data)
        if not updated_item:
             # --- ЛОГ ---
             print(f"--- [ROUTER UPDATE {item_id}] CRUD вернул None (Товар не найден) ---")
             raise HTTPException(status_code=404, detail="Товар не найден")
        # --- ЛОГ ---
        print(f"--- [ROUTER UPDATE {item_id}] CRUD успешно вернул обновленный товар: {updated_item.name} ---")
        return updated_item
    except IntegrityError:
        # --- ЛОГ ---
        print(f"--- [ROUTER UPDATE {item_id}] Произошла ошибка IntegrityError ---")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Один или несколько из предоставленных кодов уже существуют."
        )
    except ValueError as e: # Ловим ошибки из CRUD (например, если нет изменений)
        print(f"--- [ROUTER UPDATE {item_id}] Произошла ошибка ValueError: {e} ---")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e: # Ловим любые другие неожиданные ошибки
        print(f"--- [ROUTER UPDATE {item_id}] НЕОЖИДАННАЯ ОШИБКА: {type(e).__name__} - {e} ---")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Произошла внутренняя ошибка сервера при обновлении."
        )

@router.delete("/market-items/{item_id}", status_code=204)
async def archive_item_route(item_id: int, db: AsyncSession = Depends(get_db)):
    success = await crud.archive_market_item(db, item_id)
    if not success:
        raise HTTPException(status_code=404, detail="Item not found")
    return Response(status_code=204)
    
@router.get("/market-items/archived", response_model=list[schemas.MarketItemResponse])
async def get_archived_items_route(db: AsyncSession = Depends(get_db)):
    items = await crud.get_archived_items(db)
    return [{**item.__dict__, "price_spasibki": item.price} for item in items]

@router.get("/market-items", response_model=List[schemas.MarketItemResponse])
async def get_all_active_items_route(db: AsyncSession = Depends(get_db)):
    return await crud.get_active_items(db)

# --- НАЧАЛО БЛОКА: Добавляем роутер для восстановления товара ---

@router.post("/market-items/{item_id}/restore", response_model=schemas.MarketItemResponse)
async def restore_item_route(
    item_id: int, 
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user) # Защищаем эндпоинт
):
    """Восстанавливает товар из архива."""
    restored_item = await crud.admin_restore_market_item(db, item_id)
    if not restored_item:
        raise HTTPException(status_code=404, detail="Товар не найден")
    return restored_item

# --- КОНЕЦ БЛОКА ---

@router.post("/reset-balances")
async def reset_balances_route(db: AsyncSession = Depends(get_db)):
    await crud.reset_balances(db)
    return {"detail": "Balances reset successfully"}

@router.get("/users", response_model=List[schemas.UserResponse])
async def get_all_users_for_admin_route(db: AsyncSession = Depends(get_db)):
    return await crud.get_all_users_for_admin(db)

@router.put("/users/{user_id}", response_model=schemas.UserResponse)
async def admin_update_user_route(user_id: int, user_data: schemas.AdminUserUpdate, admin_user: models.User = Depends(get_current_admin_user), db: AsyncSession = Depends(get_db)):
    updated_user = await crud.admin_update_user(db, user_id, user_data, admin_user)
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")
    return updated_user

@router.delete("/users/{user_id}", status_code=204)
async def admin_delete_user_route(user_id: int, admin_user: models.User = Depends(get_current_admin_user), db: AsyncSession = Depends(get_db)):
    success = await crud.admin_delete_user(db, user_id, admin_user)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return Response(status_code=204)

# --- НОВЫЕ И ИСПРАВЛЕННЫЕ ЭНДПОИНТЫ ДЛЯ СТАТИСТИКИ ---

@router.get("/statistics/general", response_model=schemas.GeneralStatsResponse)
async def get_general_statistics_route(start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None), db: AsyncSession = Depends(get_db)):
    stats = await crud.get_general_statistics(db=db, start_date=start_date, end_date=end_date)
    return stats

@router.get("/statistics/hourly_activity", response_model=schemas.HourlyActivityStats)
async def get_hourly_activity(start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None), db: AsyncSession = Depends(get_db)):
    stats = await crud.get_hourly_activity_stats(db, start_date=start_date, end_date=end_date)
    return {"hourly_stats": stats}

@router.get("/statistics/login_activity", response_model=schemas.LoginActivityStats)
async def get_login_activity(start_date: Optional[date] = Query(None), end_date: Optional[date] = Query(None), db: AsyncSession = Depends(get_db)):
    stats = await crud.get_login_activity_stats(db, start_date=start_date, end_date=end_date)
    return {"hourly_stats": stats}

@router.get("/statistics/active_user_ratio", response_model=schemas.ActiveUserRatioStats)
async def get_active_user_ratio_route(db: AsyncSession = Depends(get_db)):
    ratio_data = await crud.get_active_user_ratio(db)
    return ratio_data

@router.get("/statistics/user_engagement", response_model=schemas.UserEngagementStats)
async def get_user_engagement(db: AsyncSession = Depends(get_db)):
    engagement_data = await crud.get_user_engagement_stats(db)
    top_senders_schema = [{"user": user, "count": count} for user, count in engagement_data["top_senders"]]
    top_receivers_schema = [{"user": user, "count": count} for user, count in engagement_data["top_receivers"]]
    return {"top_senders": top_senders_schema, "top_receivers": top_receivers_schema}

@router.get("/statistics/popular_items", response_model=schemas.PopularItemsStats)
async def get_popular_items(db: AsyncSession = Depends(get_db)):
    items_data = await crud.get_popular_items_stats(db)
    popular_items_schema = [{"item": item, "purchase_count": count} for item, count in items_data]
    return {"items": popular_items_schema}

@router.get("/statistics/inactive_users", response_model=schemas.InactiveUsersStats)
async def get_inactive_users_list(db: AsyncSession = Depends(get_db)):
    inactive_users = await crud.get_inactive_users(db)
    return {"users": inactive_users}

@router.get("/statistics/total_balance", response_model=schemas.TotalBalanceStats)
async def get_economy_total_balance(db: AsyncSession = Depends(get_db)):
    total_balance = await crud.get_total_balance(db)
    return {"total_balance": total_balance}

# --- НОВЫЙ ЭНДПОИНТ ДЛЯ СР.ВРЕМЕНИ ПОЛЬЗОВАТЕЛЯ ---

@router.get("/statistics/average_session_duration", response_model=schemas.AverageSessionDurationStats)
async def get_average_session_duration_route(
    start_date: Optional[date] = Query(None), 
    end_date: Optional[date] = Query(None), 
    db: AsyncSession = Depends(get_db)
):
    stats = await crud.get_average_session_duration(db, start_date=start_date, end_date=end_date)
    return stats

# --- НОВЫЙ ЭНДПОИНТ ДЛЯ ВЫГРУЗКИ В EXCEL ---

@router.get("/statistics/user_engagement/export")
async def export_user_engagement(db: AsyncSession = Depends(get_db)):
    engagement_data = await crud.get_user_engagement_stats(db)
    top_senders = engagement_data["top_senders"]
    top_receivers = engagement_data["top_receivers"]

    workbook = Workbook()
    
    ws_senders = workbook.active
    ws_senders.title = "Топ Донаторы"
    ws_senders.append(["#", "Имя", "Фамилия", "Должность", "Отдел", "Отправлено"])
    for i, sender in enumerate(top_senders, 1):
        user, count = sender
        ws_senders.append([i, user.first_name, user.last_name, user.position, user.department, count])

    ws_receivers = workbook.create_sheet("Топ Инфлюенсеры")
    ws_receivers.append(["#", "Имя", "Фамилия", "Должность", "Отдел", "Получено"])
    for i, receiver in enumerate(top_receivers, 1):
        user, count = receiver
        ws_receivers.append([i, user.first_name, user.last_name, user.position, user.department, count])

    file_stream = io.BytesIO()
    workbook.save(file_stream)
    file_stream.seek(0)

    return StreamingResponse(
        file_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=leaders_report.xlsx"}
    )

# --- НОВЫЙ ЭНДПОИНТ ДЛЯ СВОДНОГО ОТЧЁТА ---

@router.get("/statistics/export/consolidated")
async def export_consolidated_report(
    start_date: Optional[date] = Query(None), 
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Экспортирует сводный отчет по всем метрикам в один Excel-файл.
    """
    if end_date is None: end_date = datetime.utcnow().date()
    if start_date is None: start_date = end_date - timedelta(days=30)

    # --- ИЗМЕНЕНИЕ: Передаем диапазон дат во все функции ---
    general_stats = await crud.get_general_statistics(db, start_date, end_date)
    avg_session_stats = await crud.get_average_session_duration(db, start_date, end_date)
    engagement_data = await crud.get_user_engagement_stats(db, start_date, end_date)
    popular_items_data = await crud.get_popular_items_stats(db, start_date, end_date)
    inactive_users_data = await crud.get_inactive_users(db, start_date, end_date)
    
    general_stats['average_session_duration_minutes'] = avg_session_stats['average_duration_minutes']
    
    moscow_tz = pytz.timezone('Europe/Moscow')
    output = io.BytesIO()

    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        
        # --- ИЗМЕНЕНИЕ ЗДЕСЬ: Лист 1: Общая статистика (с переводом) ---
        
        # Создаем словарь-переводчик
        general_stats_translation = {
            "new_users_count": "Всего пользователей",
            "active_users_count": "Активные пользователи",
            "transactions_count": "Всего транзакций",
            "store_purchases_count": "Покупок в магазине",
            "total_turnover": "Оборот 'спасибок'",
            "total_store_spent": "Потрачено в магазине",
            "average_session_duration_minutes": "Среднее время сессии (мин)"
        }
        
        # Переводим ключи и создаем DataFrame
        translated_stats = {
            general_stats_translation.get(key, key): value 
            for key, value in general_stats.items()
        }
        
        df_general = pd.DataFrame.from_dict(translated_stats, orient='index', columns=['Значение'])
        df_general.index.name = 'Метрика'
        df_general.to_excel(writer, sheet_name='Общая статистика')

        # --- Остальные листы остаются без изменений ---
        # --- Лист 2: Топ Донаторы ---
        senders_list = [
            {"#": i, "Имя": user.first_name, "Фамилия": user.last_name, "Должность": user.position, "Отправлено": count}
            for i, (user, count) in enumerate(engagement_data["top_senders"], 1)
        ]
        df_senders = pd.DataFrame(senders_list)
        df_senders.to_excel(writer, sheet_name='Топ Донаторы', index=False)

        # --- Лист 3: Топ Инфлюенсеры ---
        receivers_list = [
            {"#": i, "Имя": user.first_name, "Фамилия": user.last_name, "Должность": user.position, "Получено": count}
            for i, (user, count) in enumerate(engagement_data["top_receivers"], 1)
        ]
        df_receivers = pd.DataFrame(receivers_list)
        df_receivers.to_excel(writer, sheet_name='Топ Инфлюенсеры', index=False)

        # --- Лист 4: Популярные товары ---
        items_list = [
            {"#": i, "Название товара": item.name, "Цена": item.price, "Кол-во покупок": purchase_count}
            for i, (item, purchase_count) in enumerate(popular_items_data, 1)
        ]
        df_items = pd.DataFrame(items_list)
        df_items.to_excel(writer, sheet_name='Популярные товары', index=False)

        # Лист 5: Неактивные пользователи
        inactive_list = [
            {
                "Имя": user.first_name,
                "Фамилия": user.last_name,
                "Должность": user.position,
                "Отдел": user.department,
                "Дата регистрации": user.registration_date.astimezone(moscow_tz).strftime('%Y-%m-%d %H:%M') if user.registration_date else None,
                "Последний вход": user.last_login_date.astimezone(moscow_tz).strftime('%Y-%m-%d %H:%M') if user.last_login_date else None
            }
            for user in inactive_users_data
        ]
        df_inactive = pd.DataFrame(inactive_list)
        df_inactive.to_excel(writer, sheet_name='Неактивные пользователи', index=False)

    output.seek(0)
    filename = f"consolidated_report_{start_date}_to_{end_date}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
    
# --- НОВЫЙ ЭНДПОИНТ ДЛЯ ВЫГРУЗКИ СПИСКА ПОЛЬЗОВАТЕЛЕЙ ---

@router.get("/users/export")
async def export_all_users(db: AsyncSession = Depends(get_db)):
    """
    Экспортирует полный список пользователей в Excel-файл.
    """
    # 1. Получаем всех пользователей из базы
    all_users = await crud.get_all_users_for_admin(db)

    moscow_tz = pytz.timezone('Europe/Moscow')
    
    # 2. Создаем Excel-файл в памяти
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Превращаем данные пользователей в удобный формат
        users_list = [
            {
                "ID": user.id,
                "Telegram ID": user.telegram_id,
                "Имя": user.first_name,
                "Фамилия": user.last_name,
                "Username": user.username,
                "Отдел": user.department,
                "Должность": user.position,
                "Баланс": user.balance,
                "Билеты": user.tickets,
                "Статус": user.status,
                "Админ": "Да" if user.is_admin else "Нет",
                # --- 3. Конвертируем время в MSK перед форматированием ---
                "Дата регистрации": user.registration_date.astimezone(moscow_tz).strftime('%Y-%m-%d %H:%M') if user.registration_date else None,
                "Последний вход": user.last_login_date.astimezone(moscow_tz).strftime('%Y-%m-%d %H:%M') if user.last_login_date else None
            }
            for user in all_users
        ]
        
        # Создаем таблицу и записываем ее на лист
        df_users = pd.DataFrame(users_list)
        df_users.to_excel(writer, sheet_name='Все пользователи', index=False)

    output.seek(0)

    # 3. Отдаем готовый файл
    filename = f"all_users_{datetime.utcnow().date()}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# --- НАШ НОВЫЙ ЭНДПОИНТ ДЛЯ УДАЛЕНИЯ ---
@router.delete("/market-items/{item_id}/permanent", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item_permanently_route(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user)
):
    try:
        # --- НАЧАЛО ИЗМЕНЕНИЙ: Ловим нашу новую ошибку ---
        success = await crud.admin_delete_item_permanently(db, item_id)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Товар не найден")
    except ValueError as e:
        # Если CRUD вернул ValueError, значит товар нельзя удалять
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e) # Показываем понятное сообщение об ошибке
        )
    # --- КОНЕЦ ИЗМЕНЕНИЙ ---
    
    # Возвращаем успешный ответ без тела, если удаление прошло
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# Также убедись, что вверху файла есть импорт Response:
from fastapi import Response

# --- ЭНДПОИНТЫ ДЛЯ УПРАВЛЕНИЯ STATIX BONUS ---
@router.get("/statix-bonus", response_model=schemas.StatixBonusItemResponse)
async def get_statix_bonus_settings(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user)
):
    """Получить настройки товара Statix Bonus"""
    item = await crud.get_statix_bonus_item(db)
    if not item:
        # Создаем товар по умолчанию, если его нет
        default_item = {
            "name": "Бонусы Statix",
            "description": "Покупка бонусов для платформы Statix",
            "thanks_to_statix_rate": 10,  # 10 спасибок за 100 бонусов
            "min_bonus_per_step": 100,
            "max_bonus_per_step": 10000,
            "bonus_step": 100
        }
        item = await crud.create_statix_bonus_item(db, default_item)
    return item

@router.put("/statix-bonus", response_model=schemas.StatixBonusItemResponse)
async def update_statix_bonus_settings(
    item_data: schemas.StatixBonusItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user)
):
    """Обновить настройки товара Statix Bonus"""
    # Получаем существующий товар или создаем новый
    existing_item = await crud.get_statix_bonus_item(db)
    
    if existing_item:
        # Обновляем существующий
        updated_item = await crud.update_statix_bonus_item(
            db, existing_item.id, item_data.model_dump(exclude_unset=True)
        )
    else:
        # Создаем новый с переданными данными
        default_data = {
            "name": "Бонусы Statix",
            "description": "Покупка бонусов для платформы Statix",
            "thanks_to_statix_rate": 10,
            "min_bonus_per_step": 100,
            "max_bonus_per_step": 10000,
            "bonus_step": 100
        }
        # Объединяем с переданными данными
        update_data = {**default_data, **item_data.model_dump(exclude_unset=True)}
        updated_item = await crud.create_statix_bonus_item(db, update_data)
    
    return updated_item

@router.post("/generate-leaderboard-banners", status_code=status.HTTP_201_CREATED)
async def trigger_leaderboard_banner_generation(
    admin_user: models.User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Принудительно генерирует баннеры с Топ-3 (для тестирования).
    Удаляет старые баннеры рейтинга и создает новые
    на основе данных "прошлого месяца".
    """
    try:
        # Вызываем ту же самую функцию, что и планировщик
        await crud.generate_monthly_leaderboard_banners(db)
        return {"detail": "Баннеры рейтинга успешно сгенерированы."}
    except Exception as e:
        print(f"Ошибка при ручной генерации баннеров: {e}")
        raise HTTPException(status_code=500, detail="Не удалось сгенерировать баннеры")
