# backend/routers/shared_gifts.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import crud
import schemas
from database import get_db

router = APIRouter()

@router.post("/shared-gifts/invite", response_model=schemas.SharedGiftInvitationResponse)
async def create_shared_gift_invitation(
    request: schemas.CreateSharedGiftInvitationRequest, 
    db: AsyncSession = Depends(get_db)
):
    """Создать приглашение на совместный подарок"""
    try:
        invitation = await crud.create_shared_gift_invitation(db, request)
        return invitation
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/shared-gifts/invitations/{user_id}", response_model=List[schemas.SharedGiftInvitationResponse])
async def get_user_invitations(
    user_id: int,
    status: str = None,
    db: AsyncSession = Depends(get_db)
):
    """Получить приглашения пользователя на совместные подарки"""
    invitations = await crud.get_user_shared_gift_invitations(db, user_id, status)
    return invitations

@router.post("/shared-gifts/accept", response_model=schemas.SharedGiftInvitationActionResponse)
async def accept_invitation(
    request: schemas.AcceptSharedGiftRequest,
    db: AsyncSession = Depends(get_db)
):
    """Принять приглашение на совместный подарок"""
    try:
        result = await crud.accept_shared_gift_invitation(db, request.invitation_id, request.user_id)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/shared-gifts/reject", response_model=schemas.SharedGiftInvitationActionResponse)
async def reject_invitation(
    request: schemas.RejectSharedGiftRequest,
    db: AsyncSession = Depends(get_db)
):
    """Отклонить приглашение на совместный подарок"""
    try:
        result = await crud.reject_shared_gift_invitation(db, request.invitation_id, request.user_id)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/shared-gifts/cleanup")
async def cleanup_expired_invitations(db: AsyncSession = Depends(get_db)):
    """Очистить истекшие приглашения (для админов)"""
    try:
        cleaned_count = await crud.cleanup_expired_shared_gift_invitations(db)
        return {"message": f"Очищено {cleaned_count} истекших приглашений"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при очистке: {str(e)}"
        )