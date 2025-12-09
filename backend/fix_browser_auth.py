#!/usr/bin/env python3
"""
Полный скрипт для восстановления функциональности аутентификации через браузер:
1. Применяет миграцию 006_add_browser_auth.sql
2. Раскомментирует поле login в models.py
3. Раскомментирует код в routers/auth.py
"""
import asyncio
import sys
from pathlib import Path

# Добавляем текущую директорию в путь для импорта модулей
sys.path.append(str(Path(__file__).parent))

from database import engine
from sqlalchemy import text

async def apply_migration():
    """Применяет миграцию для добавления полей аутентификации через браузер"""
    migration_file = Path(__file__).parent / "migrations" / "006_add_browser_auth.sql"
    
    if not migration_file.exists():
        print(f"❌ Файл миграции не найден: {migration_file}")
        return False
    
    print("📄 Применение миграции: 006_add_browser_auth.sql")
    
    try:
        with open(migration_file, 'r', encoding='utf-8') as f:
            migration_sql = f.read()
        
        async with engine.begin() as conn:
            await conn.execute(text(migration_sql))
            print("✅ Миграция применена успешно!")
            return True
            
    except Exception as e:
        print(f"❌ Ошибка при применении миграции: {e}")
        return False

def uncomment_login_in_models():
    """Раскомментирует поле login в models.py"""
    models_file = Path(__file__).parent / "models.py"
    
    if not models_file.exists():
        print(f"❌ Файл models.py не найден: {models_file}")
        return False
    
    try:
        with open(models_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Простая замена: раскомментируем поле login
        old_text = """    # Поля для аутентификации через браузер
    # ВРЕМЕННО ЗАКОММЕНТИРОВАНО: поле login отсутствует в БД, нужно применить миграцию 006_add_browser_auth.sql
    # login = Column(String(255), nullable=True, unique=True) # Уникальный логин для входа в браузере"""
        
        new_text = """    # Поля для аутентификации через браузер
    login = Column(String(255), nullable=True, unique=True) # Уникальный логин для входа в браузере"""
        
        if old_text in content:
            content = content.replace(old_text, new_text)
            
            with open(models_file, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print("✅ Поле 'login' раскомментировано в models.py")
            return True
        else:
            print("⚠️  Поле 'login' уже раскомментировано или паттерн не найден")
            return True
            
    except Exception as e:
        print(f"❌ Ошибка при редактировании models.py: {e}")
        return False

def uncomment_auth_code():
    """Раскомментирует код в routers/auth.py"""
    auth_file = Path(__file__).parent / "routers" / "auth.py"
    
    if not auth_file.exists():
        print(f"❌ Файл routers/auth.py не найден: {auth_file}")
        return False
    
    try:
        with open(auth_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Удаляем временное отключение функции login
        old_login_start = """    """Вход по логину и паролю."""
    # ВРЕМЕННО ОТКЛЮЧЕНО: поле login отсутствует в БД, нужно применить миграцию 006_add_browser_auth.sql
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Аутентификация через браузер временно недоступна. Примените миграцию 006_add_browser_auth.sql"
    )
    
    # Ищем пользователя по логину
    # result = await db.execute(
    #     select(models.User).where(models.User.login == request.login)
    # )
    # user = result.scalar_one_or_none()
    # 
    # if not user:
    #     raise HTTPException(
    #         status_code=status.HTTP_401_UNAUTHORIZED,
    #         detail="Неверный логин или пароль"
    #     )
    # 
    # if not user.browser_auth_enabled:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Вход через браузер не включен для этого аккаунта"
    #     )
    # 
    # if not user.password_hash or not verify_password(request.password, user.password_hash):
    #     raise HTTPException(
    #         status_code=status.HTTP_401_UNAUTHORIZED,
    #         detail="Неверный логин или пароль"
    #     )
    # 
    # if user.status != 'approved':
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Ваш аккаунт не одобрен администратором"
    #     )
    # 
    # # Создаем токен
    # access_token = create_access_token(
    #     data={"sub": str(user.id), "login": user.login},
    #     expires_delta=timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    # )
    # 
    # return TokenResponse(
    #     access_token=access_token,
    #     token_type="bearer",
    #     user=schemas.UserResponse.model_validate(user)
    # )"""
        
        new_login_start = """    """Вход по логину и паролю."""
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
    )"""
        
        if old_login_start in content:
            content = content.replace(old_login_start, new_login_start)
        
        # Раскомментируем проверку логина в register
        old_register_check = """    # ВРЕМЕННО ОТКЛЮЧЕНО: поле login отсутствует в БД
    # Проверяем, не занят ли логин
    # result = await db.execute(
    #     select(models.User).where(models.User.login == request.login)
    # )
    # existing_user = result.scalar_one_or_none()
    # 
    # if existing_user:
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST,
    #         detail="Логин уже занят"
    #     )"""
        
        new_register_check = """    # Проверяем, не занят ли логин
    result = await db.execute(
        select(models.User).where(models.User.login == request.login)
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Логин уже занят"
        )"""
        
        if old_register_check in content:
            content = content.replace(old_register_check, new_register_check)
        
        # Раскомментируем функцию generate_credentials
        old_generate_start = """    """Генерация логина и пароля для существующего пользователя."""
    # ВРЕМЕННО ОТКЛЮЧЕНО: поле login отсутствует в БД, нужно применить миграцию 006_add_browser_auth.sql
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Генерация учетных данных временно недоступна. Примените миграцию 006_add_browser_auth.sql"
    )
    
    # Валидация пароля"""
        
        new_generate_start = """    """Генерация логина и пароля для существующего пользователя."""
    # Валидация пароля"""
        
        if old_generate_start in content:
            content = content.replace(old_generate_start, new_generate_start)
        
        # Раскомментируем проверку и установку логина в generate_credentials
        old_generate_check = """    # ВРЕМЕННО ОТКЛЮЧЕНО: поле login отсутствует в БД
    # Проверяем, не занят ли логин другим пользователем
    # result = await db.execute(
    #     select(models.User).where(
    #         models.User.login == request.login,
    #         models.User.id != request.user_id
    #     )
    # )
    # existing_user = result.scalar_one_or_none()
    # 
    # if existing_user:
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST,
    #         detail="Логин уже занят"
    #     )
    # 
    # Устанавливаем логин и пароль
    # user.login = request.login
    # user.password_hash = get_password_hash(request.password)
    # user.browser_auth_enabled = True
    # 
    # await db.commit()
    # await db.refresh(user)
    # 
    # return schemas.UserResponse.model_validate(user)"""
        
        new_generate_check = """    # Проверяем, не занят ли логин другим пользователем
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
    
    return schemas.UserResponse.model_validate(user)"""
        
        if old_generate_check in content:
            content = content.replace(old_generate_check, new_generate_check)
        
        with open(auth_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print("✅ Код раскомментирован в routers/auth.py")
        return True
        
    except Exception as e:
        print(f"❌ Ошибка при редактировании routers/auth.py: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Основная функция"""
    print("🔧 Восстановление функциональности аутентификации через браузер\n")
    
    # Шаг 1: Применяем миграцию
    print("Шаг 1: Применение миграции к базе данных...")
    if not await apply_migration():
        print("\n❌ Не удалось применить миграцию. Прерывание.")
        return False
    
    print("\nШаг 2: Раскомментирование поля login в models.py...")
    if not uncomment_login_in_models():
        print("\n⚠️  Не удалось раскомментировать поле в models.py. Продолжаем...")
    
    print("\nШаг 3: Раскомментирование кода в routers/auth.py...")
    if not uncomment_auth_code():
        print("\n⚠️  Не удалось раскомментировать код в routers/auth.py. Продолжаем...")
    
    print("\n🎉 Готово! Функциональность аутентификации через браузер восстановлена.")
    print("\n📝 Рекомендуется:")
    print("   1. Перезапустить приложение")
    print("   2. Протестировать эндпоинты /auth/login и /auth/generate-credentials")
    
    return True

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
