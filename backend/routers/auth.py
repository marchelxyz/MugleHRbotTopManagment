# backend/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import timedelta
from pydantic import BaseModel
import crud, schemas, models
from database import get_db
from utils.security import verify_password, get_password_hash, create_access_token, decode_access_token
from config import settings

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)

security = HTTPBearer()

# --- СХЕМЫ ДЛЯ АУТЕНТИФИКАЦИИ ---
class LoginRequest(BaseModel):
    login: str
    password: str

class RegisterRequest(BaseModel):
    login: str
    password: str
    confirm_password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: schemas.UserResponse

class GenerateCredentialsRequest(BaseModel):
    user_id: int
    login: str
    password: str

# --- ЭНДПОИНТЫ ---

@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Вход по логину и паролю."""
    # Ищем пользователя по логину
    result = await db.execute(
        select(models.User).where(models.User.login == request.login)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль"
        )
    
    if not user.browser_auth_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вход через браузер не включен для этого аккаунта"
        )
    
    if not user.password_hash or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль"
        )
    
    if user.status != 'approved':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ваш аккаунт не одобрен администратором"
        )
    
    # Создаем токен
    access_token = create_access_token(
        data={"sub": str(user.id), "login": user.login},
        expires_delta=timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=schemas.UserResponse.model_validate(user)
    )

@router.post("/register", response_model=TokenResponse)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """Регистрация нового пользователя или привязка логина к существующему аккаунту."""
    # Валидация пароля
    if request.password != request.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пароли не совпадают"
        )
    
    if len(request.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пароль должен содержать минимум 6 символов"
        )
    
    if len(request.login) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Логин должен содержать минимум 3 символа"
        )
    
    # Проверяем, не занят ли логин
    result = await db.execute(
        select(models.User).where(models.User.login == request.login)
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Логин уже занят"
        )
    
    # ВАЖНО: Для регистрации через браузер нужна дополнительная логика
    # Пока что просто создаем нового пользователя с минимальными данными
    # В будущем можно добавить привязку к существующему аккаунту через telegram_id
    
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Регистрация через браузер пока не реализована. Обратитесь к администратору для создания аккаунта."
    )

@router.get("/me", response_model=schemas.UserResponse)
async def get_current_user_from_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Получение текущего пользователя по JWT токену."""
    token = credentials.credentials
    payload = decode_access_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен"
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен"
        )
    
    user = await crud.get_user(db, int(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    return schemas.UserResponse.model_validate(user)

@router.post("/generate-credentials", response_model=schemas.UserResponse)
async def generate_credentials(
    request: GenerateCredentialsRequest,
    db: AsyncSession = Depends(get_db)
):
    """Генерация логина и пароля для существующего пользователя."""
    # Валидация пароля
    if len(request.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пароль должен содержать минимум 6 символов"
        )
    
    if len(request.login) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Логин должен содержать минимум 3 символа"
        )
    
    # Получаем пользователя
    user = await crud.get_user(db, request.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    # Проверяем, не занят ли логин другим пользователем
    result = await db.execute(
        select(models.User).where(
            models.User.login == request.login,
            models.User.id != request.user_id
        )
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Логин уже занят"
        )
    
    # Устанавливаем логин и пароль
    user.login = request.login
    user.password_hash = get_password_hash(request.password)
    user.browser_auth_enabled = True
    
    await db.commit()
    await db.refresh(user)
    
    return schemas.UserResponse.model_validate(user)
