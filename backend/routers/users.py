from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
import crud, schemas, models
from database import get_db
from dependencies import get_current_user
from crud import verify_password, get_password_hash 

router = APIRouter(
    prefix="/users",
    tags=["users"],
)

@router.post("/auth/login", response_model=schemas.UserResponse)
async def login_user(request: schemas.LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await crud.verify_user_credentials(db, request.login, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль"
        )
    
    # Проверяем статус пользователя
    if user.status == 'blocked':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ваш аккаунт заблокирован"
        )
    
    if user.status == 'rejected':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ваша заявка была отклонена"
        )
    
    if user.status == 'pending':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ваша заявка еще на рассмотрении"
        )
    
    return schemas.UserResponse.model_validate(user)

@router.post("/auth/register", response_model=schemas.UserResponse)
async def register_user(request: schemas.RegisterRequest, db: AsyncSession = Depends(get_db)):
    if request.telegram_id:
        try:
            existing = await crud.get_user_by_telegram(db, int(request.telegram_id))
            if existing:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already registered")
        except ValueError:
            pass
    
    try:
        new_user = await crud.create_user(db, request)
        return schemas.UserResponse.model_validate(new_user)
    except ValueError as e:
        # Обрабатываем ошибки валидации (например, email уже занят)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(f"An error occurred during user creation process: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to complete registration process.")

@router.get("/", response_model=list[schemas.UserResponse])
async def list_users(db: AsyncSession = Depends(get_db)):
    return await crud.get_users(db)

@router.get("/me", response_model=schemas.UserResponse)
async def get_self(telegram_id: str = Header(alias="X-Telegram-Id"), db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_telegram(db, int(telegram_id))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

@router.put("/me", response_model=schemas.UserResponse)
async def update_me(
    user_data: schemas.UserUpdate,
    user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await crud.update_user_profile(db, user_id=user.id, data=user_data)

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

@router.get("/{user_id}/transactions", response_model=list[schemas.FeedItem])
async def get_user_transactions_route(user_id: int, db: AsyncSession = Depends(get_db)):
    return await crud.get_user_transactions(db, user_id=user_id)

@router.delete("/me/card", response_model=schemas.UserResponse)
async def delete_card(
    user: models.User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    return await crud.delete_user_card(db, user.id)

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

@router.post("/me/complete-onboarding", response_model=schemas.UserResponse)
async def complete_onboarding_route(
    user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await crud.mark_onboarding_as_seen(db, user_id=user.id)

@router.post("/me/change-password", response_model=schemas.UserResponse)
async def change_password_route(
    password_data: schemas.ChangePasswordRequest,
    user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not user.login or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="У вас нет пароля для изменения. Обратитесь к администратору."
        )
    
    # Проверяем текущий пароль
    if not verify_password(password_data.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный текущий пароль"
        )
    
    # Проверяем длину нового пароля
    if len(password_data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пароль должен содержать минимум 6 символов"
        )
    
    # Устанавливаем новый пароль
    user.password_hash = get_password_hash(password_data.new_password)
    await db.commit()
    await db.refresh(user)
    
    return schemas.UserResponse.model_validate(user)

@router.post("/me/link-account", response_model=schemas.UserResponse)
async def link_account_route(
    link_data: schemas.LinkAccountRequest,
    telegram_id: str = Header(alias="X-Telegram-Id"),
    db: AsyncSession = Depends(get_db)
):
    """
    Связывает Telegram-аккаунт с веб-аккаунтом по email.
    Доступно только для пользователей, заходящих через Telegram.
    """
    if not telegram_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Этот эндпоинт доступен только для Telegram-пользователей"
        )
    
    try:
        telegram_id_int = int(telegram_id)
        linked_user = await crud.link_telegram_to_web_account(db, telegram_id_int, link_data.email)
        return schemas.UserResponse.model_validate(linked_user)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        print(f"Ошибка при связывании аккаунтов: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось связать аккаунты"
        )
