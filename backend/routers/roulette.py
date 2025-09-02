from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import crud, schemas
from database import get_db
# --- ИЗМЕНЕНИЕ: Убираем лишний комментарий, импорт теперь корректен ---
from dependencies import get_current_user 
from models 
import User # Добавим импорт User на всякий случай

router = APIRouter(prefix="/roulette", tags=["roulette"])
router = APIRouter(prefix="/roulette", tags=["roulette"])

@router.post("/assemble", response_model=schemas.UserResponse)
async def assemble_tickets_route(user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        return await crud.assemble_tickets(db, user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/spin", response_model=schemas.SpinResponse)
async def spin_roulette_route(user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        return await crud.spin_roulette(db, user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/history", response_model=List[schemas.RouletteWinResponse])
async def get_roulette_history_route(db: AsyncSession = Depends(get_db)):
    return await crud.get_roulette_history(db)
