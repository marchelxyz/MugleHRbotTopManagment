# backend/routers/banners.py

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

import crud
import schemas
from database import get_db
from dependencies import get_current_admin_user
from models import User

router = APIRouter()

# --- ПУБЛИЧНЫЙ ЭНДПОИНТ ---
@router.get("/banners", response_model=List[schemas.BannerResponse])
async def get_active_banners_route(db: AsyncSession = Depends(get_db)):
    """Получить список активных баннеров для главной страницы."""
    return await crud.get_active_banners(db)

# --- АДМИНСКИЕ ЭНДПОИНТЫ ---
@router.get("/admin/banners", response_model=List[schemas.BannerResponse])
async def get_all_banners_route(
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить все баннеры (для админ-панели)."""
    return await crud.get_all_banners(db)

@router.post("/admin/banners", response_model=schemas.BannerResponse, status_code=status.HTTP_201_CREATED)
async def create_banner_route(
    banner: schemas.BannerCreate,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Создать новый баннер."""
    return await crud.create_banner(db, banner)

@router.put("/admin/banners/{banner_id}", response_model=schemas.BannerResponse)
async def update_banner_route(
    banner_id: int,
    banner_data: schemas.BannerUpdate,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновить существующий баннер."""
    updated_banner = await crud.update_banner(db, banner_id, banner_data)
    if not updated_banner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Banner not found")
    return updated_banner

@router.delete("/admin/banners/{banner_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_banner_route(
    banner_id: int,
    admin_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """Удалить баннер."""
    success = await crud.delete_banner(db, banner_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Banner not found")
    # --- ИЗМЕНЕНИЕ: Возвращаем правильный пустой ответ ---
    return Response(status_code=status.HTTP_204_NO_CONTENT)
