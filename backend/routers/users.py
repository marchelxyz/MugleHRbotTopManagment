from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status, Header
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
async def login_user(
    request: schemas.LoginRequest,
    db: AsyncSession = Depends(get_db),
    telegram_id: Optional[str] = Header(None, alias="X-Telegram-Id"),
):
    """
    Вход по логину и паролю.
    Если передан заголовок X-Telegram-Id, привязывает telegram_id к аккаунту
    (для пользователей, зарегистрировавшихся через веб и входящих из Telegram).
    """
    user = await crud.verify_user_credentials(db, request.login, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль"
        )
    
    # Привязка аккаунта к Telegram (если вход из Telegram WebApp)
    if telegram_id:
        try:
            tg_id = int(telegram_id)
            if tg_id < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Некорректный Telegram ID",
                )
            if user.telegram_id is None:
                existing = await crud.get_user_by_telegram(db, tg_id)
                if existing and existing.id != user.id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Этот Telegram уже привязан к другому аккаунту",
                    )
                user.telegram_id = tg_id
                await db.commit()
                await db.refresh(user)
            elif user.telegram_id != tg_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Этот аккаунт уже привязан к другому Telegram",
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Некорректный Telegram ID",
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
        # Обрабатываем ошибки валидации
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(f"An error occurred during user creation process: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to complete registration process.")

@router.get("/", response_model=list[schemas.UserResponse])
async def list_users(
    user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await crud.get_users(db)

@router.get("/me", response_model=schemas.UserResponse)
async def get_self(user: models.User = Depends(get_current_user)):
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
async def get_user_transactions_route(
    user_id: int,
    days: int = 7,
    db: AsyncSession = Depends(get_db)
):
    """
    Получает транзакции пользователя.
    Параметры:
    - days: количество дней для выборки (по умолчанию 7)
    """
    return await crud.get_user_transactions(db, user_id=user_id, days=days)

@router.post("/me/card", response_model=schemas.UserResponse)
async def upload_card(
    file: UploadFile,
    user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Загружает .pkpass файл бонусной карты через браузер."""
    if not file.filename or not file.filename.endswith('.pkpass'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Допускается только файл формата .pkpass",
        )
    file_content = await file.read()
    if not file_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл пустой",
        )
    try:
        result = await crud.process_pkpass_file(db, user.id, file_content)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ошибка при обработке файла. Убедитесь, что файл .pkpass корректен.",
        )
    await crud._create_notification(
        db, user.id, "system",
        "Бонусная карта добавлена",
        "Ваша бонусная карта успешно добавлена в профиль.",
    )
    await db.commit()
    await db.refresh(user)
    return schemas.UserResponse.model_validate(user)

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

