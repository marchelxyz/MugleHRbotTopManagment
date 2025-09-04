# backend/routers/users.py
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
import crud
import schemas
from database import get_db
from dependencies import get_current_user

router = APIRouter()

@router.post("/auth/register", response_model=schemas.UserResponse)
async def register_user(request: schemas.RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await crud.get_user_by_telegram(db, int(request.telegram_id))
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already registered")
    
    # --- НАЧАЛО ИЗМЕНЕНИЙ: Добавляем обработку ошибок ---
    try:
        new_user = await crud.create_user(db, request)
        # Явно преобразуем модель SQLAlchemy в схему Pydantic перед отправкой
        return schemas.UserResponse.model_validate(new_user)
    except Exception as e:
        # Если что-то пошло не так (например, отправка уведомления),
        # мы отправим корректную ошибку, а не уроним сервер.
        print(f"An error occurred during user creation process: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to complete registration process.")
    # --- КОНЕЦ ИЗМЕНЕНИЙ ---

@router.get("/users", response_model=list[schemas.UserResponse])
async def list_users(db: AsyncSession = Depends(get_db)):
    return await crud.get_users(db)

# --- ВОЗВРАЩАЕМ ПРОСТОЙ И ПРАВИЛЬНЫЙ КОД ---
@router.get("/users/me", response_model=schemas.UserResponse)
async def get_self(telegram_id: str = Header(alias="X-Telegram-Id"), db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_telegram(db, int(telegram_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    # Просто возвращаем объект из базы, Pydantic сделает всю работу
    return user
# --- КОНЕЦ ИЗМЕНЕНИЙ ---

@router.put("/users/me", response_model=schemas.UserResponse)
async def update_me(
    user_data: schemas.UserUpdate,
    telegram_id: str = Header(alias="X-Telegram-Id"),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_telegram(db, telegram_id=int(telegram_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    return await crud.update_user_profile(db, user_id=user.id, data=user_data)

@router.get("/{user_id}/transactions", response_model=list[schemas.FeedItem])
async def get_user_transactions_route(user_id: int, db: AsyncSession = Depends(get_db)):
    return await crud.get_user_transactions(db, user_id=user_id)

# --- ДОБАВЬТЕ ЭТОТ НОВЫЙ ЭНДПОИНТ В КОНЕЦ ФАЙЛА ---
@router.delete("/users/me/card", response_model=schemas.UserResponse)
async def delete_card(
    user: models.User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    return await crud.delete_user_card(db, user.id)
