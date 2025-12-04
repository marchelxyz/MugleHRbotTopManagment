# backend/routers/users.py
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
import crud, schemas, models
from database import get_db
from dependencies import get_current_user 

router = APIRouter(
    prefix="/users",
    tags=["users"],
)

# Путь "/auth/register" правильный, так как он не дублирует префикс
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

# --- ИСПРАВЛЕНО: было "/users", стало "/" ---
@router.get("/", response_model=list[schemas.UserResponse])
async def list_users(db: AsyncSession = Depends(get_db)):
    return await crud.get_users(db)

# --- ИСПРАВЛЕНО: было "/users/me", стало "/me" ---
@router.get("/me", response_model=schemas.UserResponse)
async def get_self(telegram_id: str = Header(alias="X-Telegram-Id"), db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_telegram(db, int(telegram_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

# --- ИСПРАВЛЕНО: было "/users/me", стало "/me" ---
@router.put("/me", response_model=schemas.UserResponse)
async def update_me(
    user_data: schemas.UserUpdate,
    user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await crud.update_user_profile(db, user_id=user.id, data=user_data)

# --- ИСПРАВЛЕНО: было "/users/me/request-update", стало "/me/request-update" ---
@router.post("/me/request-update", status_code=status.HTTP_202_ACCEPTED)
async def request_profile_update_route(
    update_request: schemas.ProfileUpdateRequest,
    user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        await crud.request_profile_update(db, user, update_request)
        return {"detail": "Update request submitted for approval."}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(f"Error requesting profile update: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to submit update request.")

# Этот путь правильный, так как он использует user_id
@router.get("/{user_id}/transactions", response_model=list[schemas.FeedItem])
async def get_user_transactions_route(user_id: int, db: AsyncSession = Depends(get_db)):
    return await crud.get_user_transactions(db, user_id=user_id)

# --- ИСПРАВЛЕНО: было "/users/me/card", стало "/me/card" ---
@router.delete("/me/card", response_model=schemas.UserResponse)
async def delete_card(
    user: models.User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    return await crud.delete_user_card(db, user.id)

# Этот путь правильный, так как он не дублирует префикс
@router.get("/search/", response_model=list[schemas.UserResponse])
async def search_users(
    query: str, 
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not query.strip():
        return []
    
    users = await crud.search_users_by_name(db, query=query)
    return users

# --- ЭНДПОИНТ ДЛЯ ИСТОРИЙ-ОБУЧЕНИЯ ---
@router.post("/me/complete-onboarding", response_model=schemas.UserResponse)
async def complete_onboarding_route(
    user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Эндпоинт для отметки о завершении просмотра обучения."""
    return await crud.mark_onboarding_as_seen(db, user_id=user.id)

# --- ЭНДПОИНТ ДЛЯ ИЗМЕНЕНИЯ СВОИХ УЧЕТНЫХ ДАННЫХ ---
@router.put("/me/credentials", response_model=schemas.UpdateMyCredentialsResponse)
async def update_my_credentials_route(
    request: schemas.UpdateMyCredentialsRequest,
    user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Изменяет логин и/или пароль текущего пользователя.
    Требует подтверждения текущим паролем.
    Доступно только для пользователей с браузерной аутентификацией.
    """
    # Проверяем, что у пользователя есть браузерная аутентификация
    if not user.browser_auth_enabled or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Браузерная аутентификация не включена для вашего аккаунта. Обратитесь к администратору."
        )
    
    try:
        updated_user = await crud.update_my_credentials(
            db,
            user=user,
            current_password=request.current_password,
            new_login=request.new_login,
            new_password=request.new_password
        )
        
        return schemas.UpdateMyCredentialsResponse(
            message="Учетные данные успешно обновлены",
            login=updated_user.login
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        print(f"Ошибка при изменении учетных данных: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось изменить учетные данные"
        )
