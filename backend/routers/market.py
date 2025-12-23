from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List 
import crud
import schemas
from database import get_db

router = APIRouter()

@router.get("/market/items", response_model=list[schemas.MarketItemResponse])
async def list_items(db: AsyncSession = Depends(get_db)):
    return await crud.get_active_items(db)

@router.post("/market/purchase", response_model=schemas.PurchaseResponse)
async def purchase_item(
    request: schemas.PurchaseRequest, db: AsyncSession = Depends(get_db)
):
    try:
        purchase_result = await crud.create_purchase(db, request)

        return {
            "message": "Purchase successful",
            "new_balance": purchase_result["new_balance"],
            "issued_code": purchase_result["issued_code"],
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/market/local-purchase", response_model=schemas.PurchaseResponse)
async def purchase_local_item(
    request: schemas.LocalGiftRequest, db: AsyncSession = Depends(get_db)
):
    try:
        purchase_result = await crud.create_local_gift(db, request)
        
        return {
            "message": "Local gift request created",
            "new_balance": purchase_result["new_balance"],
            "reserved_balance": purchase_result["reserved_balance"],
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/market/statix-bonus", response_model=schemas.StatixBonusItemResponse)
async def get_statix_bonus_item(db: AsyncSession = Depends(get_db)):
    item = await crud.get_statix_bonus_item(db)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Statix Bonus товар не настроен"
        )
    return item

@router.post("/market/statix-bonus/purchase", response_model=schemas.StatixBonusPurchaseResponse)
async def purchase_statix_bonus(
    request: schemas.StatixBonusPurchaseRequest, db: AsyncSession = Depends(get_db)
):
    try:
        result = await crud.create_statix_bonus_purchase(db, request.user_id, request.bonus_amount)
        return {
            "message": "Statix бонусы успешно приобретены",
            "new_balance": result["new_balance"],
            "purchased_bonus_amount": result["purchased_bonus_amount"]
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
