from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import crud, schemas, models
from database import get_db
from dependencies import get_current_user

router = APIRouter(prefix="/roulette", tags=["roulette"])

@router.post("/assemble", response_model=schemas.UserResponse)
async def assemble_tickets_route(user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        updated_user = await crud.assemble_tickets(db, user.id)
        return updated_user
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/spin", response_model=schemas.SpinResponse)
async def spin_roulette_route(user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        result = await crud.spin_roulette(db, user.id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/history", response_model=List[schemas.RouletteWinResponse])
async def get_roulette_history_route(db: AsyncSession = Depends(get_db)):
    return await crud.get_roulette_history(db)
