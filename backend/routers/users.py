# backend/routers/users.py
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
import crud, schemas, models
from database import get_db
# --- ИСПРАВЛЕНИЕ: Добавляем этот импорт ---
from dependencies import get_current_user 

router = APIRouter()

@router.post("/auth/register", response_model=schemas.UserResponse)
async def register_user(request: schemas.RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await crud.get_user_by_telegram(db, int(request.telegram_id))
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already registered")
    
    try:
        new_user = await crud.create_user(db, request)
        return schemas.UserResponse.model_validate(new_user)
    except Exception as e:
        print(f"An error occurred during user creation process: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to complete registration process.")

@router.get("/users", response_model=list[schemas.UserResponse])
async def list_users(db: AsyncSession = Depends(get_db)):
    return await crud.get_users(db)

@router.get("/users/me", response_model=schemas.UserResponse)
async def get_self(telegram_id: str = Header(alias="X-Telegram-Id"), db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_telegram(db, int(telegram_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

@router.put("/users/me", response_model=schemas.UserResponse)
async def update_me(
    user_data: schemas.UserUpdate,
    user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await crud.update_user_profile(db, user_id=user.id, data=user_data)

# --- ДОБАВЬТЕ ЭТОТ НОВЫЙ ЭНДПОИНТ ---
@router.post("/users/me/request-update", status_code=status.HTTP_202_ACCEPTED)
async def request_profile_update_route(
    update_request: schemas.ProfileUpdateRequest, # Используем новую схему
    user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Пользователь отправляет запрос на изменение данных. 
    Мы создаем PendingUpdate и отправляем уведомление админу.
    """
    try:
        await crud.request_profile_update(db, user, update_request)
        return {"detail": "Update request submitted for approval."}
    except ValueError as e:
        # Ловим ошибку "Изменений не найдено" из CRUD
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(f"Error requesting profile update: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to submit update request.")

@router.get("/{user_id}/transactions", response_model=list[schemas.FeedItem])
async def get_user_transactions_route(user_id: int, db: AsyncSession = Depends(get_db)):
    return await crud.get_user_transactions(db, user_id=user_id)

@router.delete("/users/me/card", response_model=schemas.UserResponse)
async def delete_card(
    user: models.User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    return await crud.delete_user_card(db, user.id)
